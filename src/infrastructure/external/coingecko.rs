use async_trait::async_trait;
use chrono::Utc;
use rust_decimal::Decimal;
use std::collections::HashMap;
use std::str::FromStr;
use std::sync::Arc;

use crate::application::ports::{PriceProvider, ProviderError};
use crate::domain::entities::{Coin, CoinMeta, Currency, Price};
use crate::infrastructure::registry::CoinRegistry;

const SIMPLE_PRICE_URL: &str = "https://api.coingecko.com/api/v3/simple/price";
const MARKETS_URL: &str = "https://api.coingecko.com/api/v3/coins/markets";

/// CoinGecko implementation of the PriceProvider port.
///
/// Holds a handle to the shared `CoinRegistry`: polling reads the current coin
/// set from it, and `discover_top` is what refreshes that set.
pub struct CoinGeckoProvider {
    client: reqwest::Client,
    registry: Arc<CoinRegistry>,
}

impl CoinGeckoProvider {
    pub fn new(registry: Arc<CoinRegistry>) -> Self {
        let client = reqwest::Client::builder()
            .user_agent("crypto-dashboard/0.2")
            .build()
            .expect("failed to build HTTP client");
        Self { client, registry }
    }

    /// Discover the top `limit` coins by market cap. Used to (re)populate the
    /// registry. One call to `/coins/markets`, ordered by market cap desc.
    pub async fn discover_top(&self, limit: usize) -> Result<Vec<CoinMeta>, ProviderError> {
        #[derive(serde::Deserialize)]
        struct Sparkline {
            #[serde(default)]
            price: Vec<f64>,
        }

        #[derive(serde::Deserialize)]
        struct MarketCoin {
            id: String,
            symbol: String,
            name: String,
            #[serde(default)]
            image: Option<String>,
            #[serde(default)]
            market_cap_rank: Option<u32>,
            #[serde(default)]
            market_cap: Option<f64>,
            #[serde(default)]
            total_volume: Option<f64>,
            #[serde(default)]
            price_change_percentage_24h: Option<f64>,
            #[serde(default)]
            circulating_supply: Option<f64>,
            #[serde(default)]
            sparkline_in_7d: Option<Sparkline>,
        }

        let per_page = limit.max(1).to_string();

        let builder = self.client.get(MARKETS_URL).query(&[
            ("vs_currency", "usd"),
            ("order", "market_cap_desc"),
            ("per_page", per_page.as_str()),
            ("page", "1"),
            ("sparkline", "true"),
            ("price_change_percentage", "24h"),
        ]);
        let resp = self.get_with_retry(builder).await?;

        if !resp.status().is_success() {
            return Err(ProviderError::UnexpectedResponse(format!(
                "HTTP {}",
                resp.status()
            )));
        }

        let coins: Vec<MarketCoin> = resp
            .json()
            .await
            .map_err(|e| ProviderError::UnexpectedResponse(e.to_string()))?;

        Ok(coins
            .into_iter()
            .map(|c| CoinMeta {
                coin: Coin::new(c.id, c.symbol.to_uppercase(), c.name),
                image: c.image,
                rank: c.market_cap_rank,
                market_cap: c.market_cap,
                volume_24h: c.total_volume,
                change_24h: c.price_change_percentage_24h,
                circulating_supply: c.circulating_supply,
                sparkline_7d: c.sparkline_in_7d.map(|s| s.price),
            })
            .collect())
    }

    /// GET with retry + exponential backoff on 429 / 5xx and transport errors.
    async fn get_with_retry(
        &self,
        builder: reqwest::RequestBuilder,
    ) -> Result<reqwest::Response, ProviderError> {
        const MAX_ATTEMPTS: u32 = 3;
        let mut attempt = 0;
        loop {
            attempt += 1;
            let req = builder
                .try_clone()
                .ok_or_else(|| ProviderError::Transport("request is not retryable".into()))?;
            match req.send().await {
                Ok(resp) => {
                    let status = resp.status();
                    if (status.as_u16() == 429 || status.is_server_error())
                        && attempt < MAX_ATTEMPTS
                    {
                        let backoff =
                            std::time::Duration::from_millis(500u64 * 2u64.pow(attempt - 1));
                        tracing::warn!(status = %status, attempt, "provider throttled; backing off");
                        tokio::time::sleep(backoff).await;
                        continue;
                    }
                    return Ok(resp);
                }
                Err(e) if attempt < MAX_ATTEMPTS => {
                    let backoff = std::time::Duration::from_millis(500u64 * 2u64.pow(attempt - 1));
                    tracing::warn!(error = %e, attempt, "provider request failed; retrying");
                    tokio::time::sleep(backoff).await;
                }
                Err(e) => return Err(ProviderError::Transport(e.to_string())),
            }
        }
    }
}

// { "bitcoin": { "usd": 1.23, "usd_24h_change": 2.34, "eur": ... }, ... }
type RawResponse = HashMap<String, HashMap<String, f64>>;

#[async_trait]
impl PriceProvider for CoinGeckoProvider {
    async fn fetch_current_prices(&self) -> Result<Vec<Price>, ProviderError> {
        // The coin set is now dynamic: read whatever the registry currently holds.
        let coins = self.registry.coins();
        if coins.is_empty() {
            // Registry not populated yet (discovery hasn't run / failed). Nothing
            // to poll this cycle — the next tick will try again once it fills.
            return Ok(Vec::new());
        }

        let ids = coins
            .iter()
            .map(|c| c.id.as_str())
            .collect::<Vec<_>>()
            .join(",");
        let vs = Currency::ALL
            .iter()
            .map(|c| c.code())
            .collect::<Vec<_>>()
            .join(",");

        let builder = self.client.get(SIMPLE_PRICE_URL).query(&[
            ("ids", ids.as_str()),
            ("vs_currencies", vs.as_str()),
            ("include_24hr_change", "true"),
        ]);
        let resp = self.get_with_retry(builder).await?;

        if !resp.status().is_success() {
            return Err(ProviderError::UnexpectedResponse(format!(
                "HTTP {}",
                resp.status()
            )));
        }

        let raw: RawResponse = resp
            .json()
            .await
            .map_err(|e| ProviderError::UnexpectedResponse(e.to_string()))?;

        let observed_at = Utc::now();
        let mut prices = Vec::with_capacity(coins.len() * Currency::ALL.len());

        for coin in &coins {
            // With a large dynamic set, a coin or a particular fiat quote may be
            // missing from a given response. Skip rather than failing the whole
            // poll — robustness matters more here than strictness.
            let Some(by_currency) = raw.get(&coin.id) else {
                continue;
            };

            for currency in Currency::ALL {
                let Some(raw_value) = by_currency.get(currency.code()) else {
                    continue;
                };

                let value = Decimal::from_str(&raw_value.to_string()).map_err(|e| {
                    ProviderError::UnexpectedResponse(format!("decimal parse: {e}"))
                })?;

                let change_key = format!("{}_24h_change", currency.code());
                let change_24h = by_currency.get(&change_key).copied();

                prices.push(Price {
                    coin: coin.clone(),
                    currency,
                    value,
                    observed_at,
                    change_24h,
                });
            }
        }

        Ok(prices)
    }
}
