use chrono::{DateTime, Utc};
use rust_decimal::Decimal;

/// A cryptocurrency we track. Previously a fixed enum; now a value type whose
/// set is decided at runtime by the CoinRegistry (top-N by market cap from the
/// provider). `id` is the CoinGecko id ("bitcoin"), `symbol` the upper-case
/// ticker ("BTC"), `name` the display name ("Bitcoin").
#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub struct Coin {
    pub id: String,
    pub symbol: String,
    pub name: String,
}

impl Coin {
    pub fn new(
        id: impl Into<String>,
        symbol: impl Into<String>,
        name: impl Into<String>,
    ) -> Self {
        Self {
            id: id.into(),
            symbol: symbol.into(),
            name: name.into(),
        }
    }

    /// CoinGecko's API identifier (also what we store in the DB `coin` column).
    pub fn coingecko_id(&self) -> &str {
        &self.id
    }

    /// Short ticker symbol, upper-case (what the API/DTO layer exposes).
    pub fn symbol(&self) -> &str {
        &self.symbol
    }

    /// Human-readable display name.
    pub fn name(&self) -> &str {
        &self.name
    }
}

/// Richer coin metadata used for discovery and the `/api/coins` endpoint.
#[derive(Debug, Clone)]
pub struct CoinMeta {
    pub coin: Coin,
    /// Icon URL from the provider, when available.
    pub image: Option<String>,
    /// Market-cap rank from the provider, when available.
    pub rank: Option<u32>,
    /// Market capitalization in USD.
    pub market_cap: Option<f64>,
    /// 24h trading volume in USD.
    pub volume_24h: Option<f64>,
    /// 24h price change percentage (USD).
    pub change_24h: Option<f64>,
    /// Circulating supply of the coin.
    pub circulating_supply: Option<f64>,
    /// 7-day price sparkline (USD), oldest → newest, from the provider.
    pub sparkline_7d: Option<Vec<f64>>,
}

/// Fiat currencies we quote prices in. Genuinely fixed, so still an enum.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum Currency {
    Usd,
    Eur,
    Jpy,
    Rub,
}

impl Currency {
    pub const ALL: [Currency; 4] = [Currency::Usd, Currency::Eur, Currency::Jpy, Currency::Rub];

    pub fn code(&self) -> &'static str {
        match self {
            Currency::Usd => "usd",
            Currency::Eur => "eur",
            Currency::Jpy => "jpy",
            Currency::Rub => "rub",
        }
    }
}

#[derive(Debug, Clone)]
pub struct Price {
    pub coin: Coin,
    pub currency: Currency,
    pub value: Decimal,
    pub observed_at: DateTime<Utc>,
    pub change_24h: Option<f64>,
}

#[derive(Debug, Clone)]
pub struct PricePoint {
    pub value: Decimal,
    pub observed_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Period {
    Day,
    Week,
    Month,
}

impl Period {
    pub fn duration(&self) -> chrono::Duration {
        match self {
            Period::Day => chrono::Duration::days(1),
            Period::Week => chrono::Duration::weeks(1),
            Period::Month => chrono::Duration::days(30),
        }
    }

    /// Postgres `date_trunc` unit used to bucket ticks into OHLC candles.
    pub fn bucket_unit(&self) -> &'static str {
        match self {
            Period::Day => "hour",
            Period::Week => "day",
            Period::Month => "day",
        }
    }
}

/// One OHLC candle over a time bucket — derived from stored ticks.
#[derive(Debug, Clone)]
pub struct Candle {
    pub bucket: DateTime<Utc>,
    pub open: Decimal,
    pub high: Decimal,
    pub low: Decimal,
    pub close: Decimal,
}

#[derive(Debug, Clone)]
pub struct PriceExtremes {
    pub coin: Coin,
    pub currency: Currency,
    pub period: Period,
    pub highest: Decimal,
    pub lowest: Decimal,
}

/// An authenticated account. Passwords are stored only as Argon2 hashes.
#[derive(Debug, Clone)]
pub struct User {
    pub id: i64,
    pub username: String,
    pub password_hash: String,
    pub role: String,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn coin_accessors() {
        let c = Coin::new("bitcoin", "BTC", "Bitcoin");
        assert_eq!(c.coingecko_id(), "bitcoin");
        assert_eq!(c.symbol(), "BTC");
        assert_eq!(c.name(), "Bitcoin");
    }

    #[test]
    fn currency_codes_and_count() {
        assert_eq!(Currency::Usd.code(), "usd");
        assert_eq!(Currency::ALL.len(), 4);
    }

    #[test]
    fn period_bucket_units_and_duration() {
        assert_eq!(Period::Day.bucket_unit(), "hour");
        assert_eq!(Period::Week.bucket_unit(), "day");
        assert_eq!(Period::Month.bucket_unit(), "day");
        assert_eq!(Period::Day.duration(), chrono::Duration::days(1));
    }
}
