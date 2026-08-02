use std::env;

/// Which TLS verification level to use for the Postgres connection.
/// Maps from the DB_SSL_MODE env var. Start at `Require`, move to
/// `VerifyFull` by editing .env (and providing a CA cert path).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SslMode {
    Disable,
    Prefer,
    Require,
    VerifyFull,
}

impl SslMode {
    fn from_env_str(s: &str) -> Result<Self, ConfigError> {
        match s.trim().to_lowercase().as_str() {
            "disable" | "disabled" | "off" => Ok(SslMode::Disable),
            // "enable"/"allow" are non-standard but common — treat as opportunistic.
            "prefer" | "allow" | "enable" => Ok(SslMode::Prefer),
            "require" | "on" => Ok(SslMode::Require),
            "verify-full" | "verify_full" => Ok(SslMode::VerifyFull),
            other => Err(ConfigError::InvalidSslMode(other.to_string())),
        }
    }
}

/// All configuration the app needs, loaded once at startup.
#[derive(Debug, Clone)]
pub struct Config {
    pub database_url: String,
    pub db_max_connections: u32,
    pub db_ssl_mode: SslMode,
    /// Path to the CA certificate, required only for VerifyFull.
    pub db_ca_cert_path: Option<String>,
    pub poll_interval_seconds: u64,
    /// How many coins to track (top-N by market cap).
    pub tracked_coins_limit: usize,
    /// How often to re-discover the top-N coin set, in seconds.
    pub coin_refresh_seconds: u64,
    /// Exact allowed CORS origin (e.g. http://localhost:4321). None = allow any (dev).
    pub cors_allowed_origin: Option<String>,
    /// Max requests per IP per minute. 0 disables rate limiting.
    pub rate_limit_per_min: u32,
    /// Secret used to sign JWT session tokens.
    pub jwt_secret: String,
    /// Session token lifetime in hours.
    pub token_ttl_hours: u64,
}

#[derive(Debug, thiserror::Error)]
pub enum ConfigError {
    #[error("missing required environment variable: {0}")]
    MissingVar(String),

    #[error("invalid value for {var}: {value}")]
    InvalidValue { var: String, value: String },

    #[error("invalid DB_SSL_MODE: {0} (expected 'disable', 'prefer', 'require', or 'verify-full')")]
    InvalidSslMode(String),

    #[error("DB_SSL_MODE=verify-full requires DB_CA_CERT_PATH to be set")]
    MissingCaCertForVerifyFull,
}

impl Config {
    /// Load configuration from environment variables.
    /// Call `dotenvy::dotenv()` before this in main() to populate from `.env`.
    pub fn from_env() -> Result<Self, ConfigError> {

        let poll_interval_seconds = match env::var("POLL_INTERVAL_SECONDS") {
    Ok(v) => v.parse::<u64>().map_err(|_| ConfigError::InvalidValue {
        var: "POLL_INTERVAL_SECONDS".into(),
        value: v,
    })?,
    Err(_) => 300,
};
        let tracked_coins_limit = match env::var("TRACKED_COINS_LIMIT") {
            Ok(v) => v.parse::<usize>().map_err(|_| ConfigError::InvalidValue {
                var: "TRACKED_COINS_LIMIT".into(),
                value: v,
            })?,
            Err(_) => 25,
        };

        let coin_refresh_seconds = match env::var("COIN_REFRESH_SECONDS") {
            Ok(v) => v.parse::<u64>().map_err(|_| ConfigError::InvalidValue {
                var: "COIN_REFRESH_SECONDS".into(),
                value: v,
            })?,
            Err(_) => 3600,
        };

        let cors_allowed_origin = env::var("CORS_ALLOWED_ORIGIN").ok().filter(|s| !s.is_empty());

        let rate_limit_per_min = match env::var("RATE_LIMIT_PER_MIN") {
            Ok(v) => v.parse::<u32>().map_err(|_| ConfigError::InvalidValue {
                var: "RATE_LIMIT_PER_MIN".into(),
                value: v,
            })?,
            Err(_) => 120,
        };

        let jwt_secret = env::var("JWT_SECRET").unwrap_or_else(|_| "dev-secret-change-me".into());

        let token_ttl_hours = match env::var("TOKEN_TTL_HOURS") {
            Ok(v) => v.parse::<u64>().map_err(|_| ConfigError::InvalidValue {
                var: "TOKEN_TTL_HOURS".into(),
                value: v,
            })?,
            Err(_) => 24,
        };

        let database_url = required("DATABASE_URL")?;

        let db_max_connections = match env::var("DB_MAX_CONNECTIONS") {
            Ok(v) => v.parse::<u32>().map_err(|_| ConfigError::InvalidValue {
                var: "DB_MAX_CONNECTIONS".into(),
                value: v,
            })?,
            Err(_) => 5, // sensible default
        };

        let db_ssl_mode = {
            let raw = env::var("DB_SSL_MODE").unwrap_or_else(|_| "require".into());
            SslMode::from_env_str(&raw)?
        };

        let db_ca_cert_path = env::var("DB_CA_CERT_PATH")
            .ok()
            .filter(|s| !s.trim().is_empty());

        // Enforce the invariant: verify-full is meaningless without a CA cert.
        if db_ssl_mode == SslMode::VerifyFull && db_ca_cert_path.is_none() {
            return Err(ConfigError::MissingCaCertForVerifyFull);
        }

        Ok(Config {
            database_url,
            db_max_connections,
            db_ssl_mode,
            db_ca_cert_path,
            poll_interval_seconds,
            tracked_coins_limit,
            coin_refresh_seconds,
            cors_allowed_origin,
            rate_limit_per_min,
            jwt_secret,
            token_ttl_hours,
        })
    }
}

fn required(key: &str) -> Result<String, ConfigError> {
    env::var(key).map_err(|_| ConfigError::MissingVar(key.to_string()))
}