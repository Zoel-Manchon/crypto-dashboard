use std::sync::Arc;
use crate::domain::entities::Price;
use crate::application::ports::{PriceProvider, PriceRepository, ProviderError, RepositoryError};

/// Errors that can occur during a poll cycle.
#[derive(Debug, thiserror::Error)]
pub enum PollError {
    #[error("provider failed: {0}")]
    Provider(#[from] ProviderError),

    #[error("repository failed: {0}")]
    Repository(#[from] RepositoryError),
}

/// Use case: fetch current prices and persist them. One poll cycle.
/// Depends only on ports — knows nothing of CoinGecko or sqlx.
pub struct PollPricesUseCase {
    provider: Arc<dyn PriceProvider>,
    repository: Arc<dyn PriceRepository>,
}

impl PollPricesUseCase {
    pub fn new(
        provider: Arc<dyn PriceProvider>,
        repository: Arc<dyn PriceRepository>,
    ) -> Self {
        Self { provider, repository }
    }

    /// Execute a single fetch-and-save cycle. Returns how many snapshots
    /// were saved, for logging.
    pub async fn execute(&self) -> Result<Vec<Price>, PollError> {
        let prices = self.provider.fetch_current_prices().await?;
        self.repository.save_prices(&prices).await?;
        Ok(prices)
    }
}