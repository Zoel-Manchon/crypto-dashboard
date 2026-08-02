/// Errors that arise from domain rules and conversions, independent of
/// any database or network concern.
#[derive(Debug, thiserror::Error)]
pub enum DomainError {
    #[error("unknown coin: {0}")]
    UnknownCoin(String),

    #[error("unknown currency: {0}")]
    UnknownCurrency(String),

    #[error("unknown period: {0}")]
    UnknownPeriod(String),
}

// Parsing helpers — useful when data comes back as strings (query params, DB)
// and must be turned into our typed values. Coin is no longer a fixed enum, so
// its resolution lives in the CoinRegistry; only Currency and Period stay here.
use crate::domain::entities::{Currency, Period};

impl Currency {
    pub fn from_code(s: &str) -> Result<Self, DomainError> {
        match s.trim().to_lowercase().as_str() {
            "usd" => Ok(Currency::Usd),
            "eur" => Ok(Currency::Eur),
            "jpy" | "yen" => Ok(Currency::Jpy),
            "rub" | "ruble" | "rubles" | "rouble" | "roubles" => Ok(Currency::Rub),
            other => Err(DomainError::UnknownCurrency(other.to_string())),
        }
    }
}

impl Period {
    pub fn from_str_label(s: &str) -> Result<Self, DomainError> {
        match s.trim().to_lowercase().as_str() {
            "day" => Ok(Period::Day),
            "week" => Ok(Period::Week),
            "month" => Ok(Period::Month),
            other => Err(DomainError::UnknownPeriod(other.to_string())),
        }
    }
}

#[cfg(test)]
mod tests {
    use crate::domain::entities::{Currency, Period};

    #[test]
    fn currency_from_code_parses_known() {
        assert_eq!(Currency::from_code("usd").unwrap(), Currency::Usd);
        assert_eq!(Currency::from_code("EUR").unwrap(), Currency::Eur);
        assert_eq!(Currency::from_code("yen").unwrap(), Currency::Jpy);
        assert_eq!(Currency::from_code(" rub ").unwrap(), Currency::Rub);
    }

    #[test]
    fn currency_from_code_rejects_unknown() {
        assert!(Currency::from_code("gbp").is_err());
    }

    #[test]
    fn period_from_label_parses_and_rejects() {
        assert_eq!(Period::from_str_label("day").unwrap(), Period::Day);
        assert_eq!(Period::from_str_label("WEEK").unwrap(), Period::Week);
        assert!(Period::from_str_label("year").is_err());
    }
}
