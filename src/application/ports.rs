use async_trait::async_trait;

use crate::domain::entities::{Candle, Coin, Currency, Period, Price, PriceExtremes, PricePoint};

/// Port: fetches current prices from an external source (e.g. CoinGecko).
/// Infrastructure implements this; the application only knows the trait.
#[async_trait]
pub trait PriceProvider: Send + Sync {
    /// Fetch the current price for every tracked coin in every currency.
    /// The coin set is decided by the registry the provider holds.
    async fn fetch_current_prices(&self) -> Result<Vec<Price>, ProviderError>;
}

/// Port: persists and queries price snapshots.
#[async_trait]
pub trait PriceRepository: Send + Sync {
    /// Persist a batch of snapshots (one polling cycle).
    async fn save_prices(&self, prices: &[Price]) -> Result<(), RepositoryError>;

    /// Most recent snapshot for a coin/currency — powers the price cards.
    async fn latest_price(
        &self,
        coin: &Coin,
        currency: Currency,
    ) -> Result<Option<Price>, RepositoryError>;

    /// Highest & lowest over a period — powers the Highest/Lowest tabs.
    async fn extremes(
        &self,
        coin: &Coin,
        currency: Currency,
        period: Period,
    ) -> Result<Option<PriceExtremes>, RepositoryError>;

    /// Time-series for charts over a period.
    async fn series(
        &self,
        coin: &Coin,
        currency: Currency,
        period: Period,
    ) -> Result<Vec<PricePoint>, RepositoryError>;

    /// OHLC candles bucketed from stored ticks over a period.
    async fn ohlc(
        &self,
        coin: &Coin,
        currency: Currency,
        period: Period,
    ) -> Result<Vec<Candle>, RepositoryError>;
}

/// Port: user accounts + their synced preferences (#8).
#[async_trait::async_trait]
pub trait UserRepository: Send + Sync {
    /// Create a user; returns the new id. Duplicate usernames yield Conflict.
    async fn create_user(&self, username: &str, password_hash: &str) -> Result<i64, RepositoryError>;
    async fn find_by_username(&self, username: &str) -> Result<Option<crate::domain::entities::User>, RepositoryError>;
    async fn get_prefs(&self, user_id: i64) -> Result<Option<String>, RepositoryError>;
    async fn put_prefs(&self, user_id: i64, prefs: &str) -> Result<(), RepositoryError>;
}

#[derive(Debug, thiserror::Error)]
pub enum ProviderError {
    #[error("network/transport error: {0}")]
    Transport(String),

    #[error("unexpected response from provider: {0}")]
    UnexpectedResponse(String),
}

#[derive(Debug, thiserror::Error)]
pub enum RepositoryError {
    #[error("database error: {0}")]
    Database(String),

    #[error("conflict: {0}")]
    Conflict(String),
}
