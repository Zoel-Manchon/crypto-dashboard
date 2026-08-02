use async_trait::async_trait;
use chrono::Utc;
use std::str::FromStr;

use sqlx::postgres::{PgConnectOptions, PgPool, PgPoolOptions, PgSslMode};

use crate::application::ports::{PriceRepository, RepositoryError};
use crate::domain::entities::{Candle, Coin, Currency, Period, Price, PriceExtremes, PricePoint};
use crate::infrastructure::config::{Config, SslMode};

#[derive(Debug, thiserror::Error)]
pub enum DbError {
    #[error("failed to parse DATABASE_URL: {0}")]
    InvalidUrl(#[source] sqlx::Error),

    #[error("failed to connect to database: {0}")]
    Connection(#[source] sqlx::Error),

    #[error("health check query failed: {0}")]
    HealthCheck(#[source] sqlx::Error),
}

/// Build a TLS-configured Postgres connection pool from app config.
pub async fn create_pool(config: &Config) -> Result<PgPool, DbError> {
    // Parse the base connection info from the URL...
    let mut connect_options =
        PgConnectOptions::from_str(&config.database_url).map_err(DbError::InvalidUrl)?;

    // ...then layer our TLS settings on top.
    connect_options = match config.db_ssl_mode {
        SslMode::Disable => connect_options.ssl_mode(PgSslMode::Disable),
        SslMode::Prefer => connect_options.ssl_mode(PgSslMode::Prefer),
        SslMode::Require => connect_options.ssl_mode(PgSslMode::Require),
        SslMode::VerifyFull => {
            let mut opts = connect_options.ssl_mode(PgSslMode::VerifyFull);
            if let Some(ca_path) = &config.db_ca_cert_path {
                opts = opts.ssl_root_cert(ca_path);
            }
            opts
        }
    };

    let pool = PgPoolOptions::new()
        .max_connections(config.db_max_connections)
        .connect_with(connect_options)
        .await
        .map_err(DbError::Connection)?;

    Ok(pool)
}

/// Verify the connection is live by running a trivial query over the
/// (encrypted) connection. Returns Ok(()) if the round-trip succeeds.
pub async fn health_check(pool: &PgPool) -> Result<(), DbError> {
    let row: (i32,) = sqlx::query_as("SELECT 1")
        .fetch_one(pool)
        .await
        .map_err(DbError::HealthCheck)?;

    debug_assert_eq!(row.0, 1);
    Ok(())
}





/// sqlx-backed implementation of the PriceRepository port.
pub struct PgPriceRepository {
    pool: PgPool,
}

impl PgPriceRepository {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }
}

// Map sqlx errors into the domain-friendly RepositoryError at the boundary,
// so the application layer never sees sqlx types.
fn map_db_err(e: sqlx::Error) -> RepositoryError {
    RepositoryError::Database(e.to_string())
}

#[async_trait]
impl PriceRepository for PgPriceRepository {
    async fn save_prices(&self, prices: &[Price]) -> Result<(), RepositoryError> {
        // Batch insert. For 8 rows per cycle a simple loop in one
        // transaction is plenty; we can switch to UNNEST bulk insert later.
        let mut tx = self.pool.begin().await.map_err(map_db_err)?;

        for p in prices {
            sqlx::query(
                "INSERT INTO prices (coin, currency, value, observed_at, change_24h)
                 VALUES ($1, $2, $3, $4, $5)",
            )
            .bind(p.coin.coingecko_id())
            .bind(p.currency.code())
            .bind(p.value)
            .bind(p.observed_at)
            .bind(p.change_24h)
            .execute(&mut *tx)
            .await
            .map_err(map_db_err)?;
        }

        tx.commit().await.map_err(map_db_err)?;
        Ok(())
    }

    async fn latest_price(
        &self,
        coin: &Coin,
        currency: Currency,
    ) -> Result<Option<Price>, RepositoryError> {
        let row = sqlx::query_as::<_, (rust_decimal::Decimal, chrono::DateTime<Utc>, Option<f64>)>(
            "SELECT value, observed_at, change_24h
             FROM prices
             WHERE coin = $1 AND currency = $2
             ORDER BY observed_at DESC
             LIMIT 1",
        )
        .bind(coin.coingecko_id())
        .bind(currency.code())
        .fetch_optional(&self.pool)
        .await
        .map_err(map_db_err)?;

        Ok(row.map(|(value, observed_at, change_24h)| Price {
            coin: coin.clone(),
            currency,
            value,
            observed_at,
            change_24h,
        }))
    }

    async fn extremes(
        &self,
        coin: &Coin,
        currency: Currency,
        period: Period,
    ) -> Result<Option<PriceExtremes>, RepositoryError> {
        let since = Utc::now() - period.duration();

        let row = sqlx::query_as::<_, (Option<rust_decimal::Decimal>, Option<rust_decimal::Decimal>)>(
            "SELECT MAX(value), MIN(value)
             FROM prices
             WHERE coin = $1 AND currency = $2 AND observed_at >= $3",
        )
        .bind(coin.coingecko_id())
        .bind(currency.code())
        .bind(since)
        .fetch_one(&self.pool)
        .await
        .map_err(map_db_err)?;

        // Both NULL means no rows in the window.
        match (row.0, row.1) {
            (Some(highest), Some(lowest)) => Ok(Some(PriceExtremes {
                coin: coin.clone(),
                currency,
                period,
                highest,
                lowest,
            })),
            _ => Ok(None),
        }
    }

    async fn series(
        &self,
        coin: &Coin,
        currency: Currency,
        period: Period,
    ) -> Result<Vec<PricePoint>, RepositoryError> {
        let since = Utc::now() - period.duration();

        let rows = sqlx::query_as::<_, (rust_decimal::Decimal, chrono::DateTime<Utc>)>(
            "SELECT value, observed_at
             FROM prices
             WHERE coin = $1 AND currency = $2 AND observed_at >= $3
             ORDER BY observed_at ASC",
        )
        .bind(coin.coingecko_id())
        .bind(currency.code())
        .bind(since)
        .fetch_all(&self.pool)
        .await
        .map_err(map_db_err)?;

        Ok(rows
            .into_iter()
            .map(|(value, observed_at)| PricePoint { value, observed_at })
            .collect())
    }

    async fn ohlc(
        &self,
        coin: &Coin,
        currency: Currency,
        period: Period,
    ) -> Result<Vec<Candle>, RepositoryError> {
        let since = Utc::now() - period.duration();
        let unit = period.bucket_unit();

        // Bucket ticks with date_trunc, then take first/last value per bucket via
        // ordered array_agg (open/close) alongside MAX/MIN (high/low).
        let rows = sqlx::query_as::<
            _,
            (
                chrono::DateTime<Utc>,
                rust_decimal::Decimal,
                rust_decimal::Decimal,
                rust_decimal::Decimal,
                rust_decimal::Decimal,
            ),
        >(
            "SELECT
                date_trunc($4, observed_at)                     AS bucket,
                (array_agg(value ORDER BY observed_at ASC))[1]  AS open,
                MAX(value)                                       AS high,
                MIN(value)                                       AS low,
                (array_agg(value ORDER BY observed_at DESC))[1] AS close
             FROM prices
             WHERE coin = $1 AND currency = $2 AND observed_at >= $3
             GROUP BY bucket
             ORDER BY bucket ASC",
        )
        .bind(coin.coingecko_id())
        .bind(currency.code())
        .bind(since)
        .bind(unit)
        .fetch_all(&self.pool)
        .await
        .map_err(map_db_err)?;

        Ok(rows
            .into_iter()
            .map(|(bucket, open, high, low, close)| Candle {
                bucket,
                open,
                high,
                low,
                close,
            })
            .collect())
    }
}

