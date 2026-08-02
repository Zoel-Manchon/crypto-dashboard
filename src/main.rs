use std::sync::Arc;
use std::time::Duration;

use tokio::sync::broadcast;
use tokio::time::{MissedTickBehavior, interval};

use crypto_dashboard::application::ports::{PriceProvider, PriceRepository};
use crypto_dashboard::domain::entities::{CoinMeta, Currency};
use crypto_dashboard::application::use_cases::PollPricesUseCase;
use crypto_dashboard::domain::entities::Price;
use crypto_dashboard::infrastructure::config::Config;
use crypto_dashboard::infrastructure::external::coingecko::CoinGeckoProvider;
use crypto_dashboard::infrastructure::persistence::postgres::{self, PgPriceRepository};
use crypto_dashboard::infrastructure::persistence::users::PgUserRepository;
use crypto_dashboard::presentation::auth::JwtKeys;
use crypto_dashboard::infrastructure::metrics::AppMetrics;
use crypto_dashboard::infrastructure::rate_limit::RateLimiter;
use crypto_dashboard::infrastructure::registry::CoinRegistry;
use crypto_dashboard::infrastructure::scheduler;
use crypto_dashboard::presentation::{handlers::AppState, router::build_router};

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Load .env into the environment.
    dotenvy::dotenv().ok();

    // Initialize logging.
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env().unwrap_or_else(|_| "info".into()),
        )
        .init();

    // Load typed config.
    let config = Config::from_env()?;
    tracing::info!(ssl_mode = ?config.db_ssl_mode, "configuration loaded");

    // Build the TLS-enabled connection pool.
    let pool = postgres::create_pool(&config).await?;
    tracing::info!("connection pool created");

    // Prove the encrypted connection works.
    // Prove the connection works, then ensure the schema exists. Running
    // migrations on startup means a fresh database (e.g. the docker volume)
    // is set up automatically — no manual psql step.
    postgres::health_check(&pool).await?;
    tracing::info!(ssl_mode = ?config.db_ssl_mode, "database health check passed");

    sqlx::migrate!("./migrations").run(&pool).await?;
    tracing::info!("database migrations applied");

    // --- Build the adapters (concrete implementations of the ports). ---
    let registry = Arc::new(CoinRegistry::new());
    let metrics = Arc::new(AppMetrics::new());
    let rate_limiter = Arc::new(RateLimiter::per_minute(config.rate_limit_per_min));
    let provider = Arc::new(CoinGeckoProvider::new(registry.clone()));
    let repository = Arc::new(PgPriceRepository::new(pool.clone()));
    let users = Arc::new(PgUserRepository::new(pool.clone()));
    if config.jwt_secret == "dev-secret-change-me" {
        tracing::warn!("JWT_SECRET is the dev default — set a real secret in production");
    }
    let jwt = Arc::new(JwtKeys::new(&config.jwt_secret, config.token_ttl_hours));

    // --- Discover the initial top-N coin set BEFORE the first poll, so the
    //     polling loop has ids to work with on its very first tick. ---
    match provider.discover_top(config.tracked_coins_limit).await {
        Ok(metas) => {
            let n = metas.len();
            registry.replace(metas);
            metrics.record_discovery_ok(n);
            tracing::info!(n, "coin registry populated");
            // Seed historical prices from the 7d sparklines we already fetched
            // (USD only, zero extra API calls) so charts aren't empty on boot.
            backfill_from_sparklines(&repository, &registry.snapshot()).await;
        }
        Err(e) => {
            metrics.record_discovery_err();
            tracing::warn!(error = %e, "initial coin discovery failed; will retry on refresh");
        }
    }

    // --- Periodic registry refresh: re-rank the top-N coins on an interval. ---
    {
        let provider_disc = provider.clone();
        let registry_disc = registry.clone();
        let metrics_disc = metrics.clone();
        let limit = config.tracked_coins_limit;
        let refresh_secs = config.coin_refresh_seconds;
        tokio::spawn(async move {
            let mut ticker = interval(Duration::from_secs(refresh_secs));
            ticker.set_missed_tick_behavior(MissedTickBehavior::Skip);
            ticker.tick().await; // consume the immediate first tick (already discovered above)
            loop {
                ticker.tick().await;
                match provider_disc.discover_top(limit).await {
                    Ok(metas) => {
                        let n = metas.len();
                        registry_disc.replace(metas);
                        metrics_disc.record_discovery_ok(n);
                        tracing::info!(n, "coin registry refreshed");
                    }
                    Err(e) => {
                        metrics_disc.record_discovery_err();
                        tracing::warn!(error = %e, "coin discovery refresh failed");
                    }
                }
            }
        });
    }

    // Wire provider + repository into the polling use case (via the port traits).
    let poll_provider: Arc<dyn PriceProvider> = provider.clone();
    let poll_use_case = Arc::new(PollPricesUseCase::new(poll_provider, repository.clone()));

    // --- Broadcast channel: one sender, shared by the loop and the WS state. ---
    let (tx, _rx) = broadcast::channel::<Vec<Price>>(16);

    // --- Spawn the polling loop as a background task. ---
    let interval_secs = config.poll_interval_seconds;
    let tx_for_loop = tx.clone();
    let metrics_loop = metrics.clone();
    let poll_handle = tokio::spawn(async move {
        scheduler::run_polling_loop(poll_use_case, interval_secs, tx_for_loop, metrics_loop).await;
    });

    // --- Build the HTTP server, sharing repository + broadcaster + registry. ---
    let repo_dyn: Arc<dyn PriceRepository> = repository.clone();
    let state = AppState {
        repository: repo_dyn,
        broadcaster: tx,
        registry: registry.clone(),
        metrics: metrics.clone(),
        rate_limiter: rate_limiter.clone(),
        users: users.clone(),
        jwt: jwt.clone(),
    };
    let app = build_router(state, config.cors_allowed_origin.clone());

    // Bind on all interfaces (0.0.0.0) so the server is reachable from outside
    // the container. Binding 127.0.0.1 here would make Docker's published port
    // unreachable from the host. Honors PORT (set in docker-compose), default 8080.
    let port: u16 = std::env::var("PORT")
        .ok()
        .and_then(|p| p.parse().ok())
        .unwrap_or(8080);
    let addr = format!("0.0.0.0:{port}");
    let listener = tokio::net::TcpListener::bind(&addr).await?;
    tracing::info!("HTTP server listening on http://{addr}");

    axum::serve(
        listener,
        app.into_make_service_with_connect_info::<std::net::SocketAddr>(),
    )
        .with_graceful_shutdown(async {
            tokio::signal::ctrl_c().await.ok();
            tracing::info!("HTTP server shutting down");
        })
        .await?;

    poll_handle.abort();
    tracing::info!("shutdown complete");
    Ok(())
}

/// Seed the DB with ~7 days of USD price history reconstructed from each coin's
/// provider sparkline. Runs only when the table is empty, so restarts don't
/// duplicate. Timestamps are synthesized evenly across the 7-day window.
async fn backfill_from_sparklines(
    repository: &Arc<PgPriceRepository>,
    metas: &[CoinMeta],
) {
    use chrono::{Duration as ChronoDuration, Utc};
    use crypto_dashboard::domain::entities::{Coin, Price};
    use rust_decimal::Decimal;
    use std::str::FromStr;

    // Skip if we already have data (avoids duplicate seeding on restart).
    if let Some(first) = metas.first() {
        if let Ok(Some(_)) = repository.latest_price(&first.coin, Currency::Usd).await {
            tracing::info!("price history present; skipping sparkline backfill");
            return;
        }
    }

    let now = Utc::now();
    let window_secs = ChronoDuration::days(7).num_seconds() as f64;
    let mut points: Vec<Price> = Vec::new();

    for m in metas {
        let Some(spark) = &m.sparkline_7d else { continue };
        let n = spark.len();
        if n < 2 {
            continue;
        }
        let coin: Coin = m.coin.clone();
        for (i, v) in spark.iter().enumerate() {
            let frac = i as f64 / (n as f64 - 1.0);
            let offset = (window_secs * (1.0 - frac)) as i64;
            let observed_at = now - ChronoDuration::seconds(offset);
            let Ok(value) = Decimal::from_str(&v.to_string()) else { continue };
            points.push(Price {
                coin: coin.clone(),
                currency: Currency::Usd,
                value,
                observed_at,
                change_24h: None,
            });
        }
    }

    if points.is_empty() {
        return;
    }
    match repository.save_prices(&points).await {
        Ok(_) => tracing::info!(rows = points.len(), "seeded price history from sparklines"),
        Err(e) => tracing::warn!(error = %e, "history backfill failed"),
    }
}
