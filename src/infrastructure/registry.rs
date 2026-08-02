use std::sync::RwLock;

use crate::domain::entities::{Coin, CoinMeta};

/// Runtime registry of the coins we currently track. Populated and periodically
/// refreshed from the provider's market-cap ranking (top-N). This is what
/// replaces the old compile-time `Coin::ALL`.
///
/// Reads are short and lock-free of `.await` (we never hold the guard across an
/// await point), so a std `RwLock` is the right tool here.
pub struct CoinRegistry {
    inner: RwLock<Vec<CoinMeta>>,
}

impl CoinRegistry {
    pub fn new() -> Self {
        Self {
            inner: RwLock::new(Vec::new()),
        }
    }

    /// Atomically swap in a freshly discovered coin set.
    pub fn replace(&self, coins: Vec<CoinMeta>) {
        let mut guard = self.inner.write().expect("coin registry lock poisoned");
        *guard = coins;
    }

    /// Full metadata snapshot (cloned) — powers `GET /api/coins`.
    pub fn snapshot(&self) -> Vec<CoinMeta> {
        self.inner.read().expect("coin registry lock poisoned").clone()
    }

    /// Just the coins, in registry order — what handlers iterate over.
    pub fn coins(&self) -> Vec<Coin> {
        self.inner
            .read()
            .expect("coin registry lock poisoned")
            .iter()
            .map(|m| m.coin.clone())
            .collect()
    }

    pub fn is_empty(&self) -> bool {
        self.inner.read().expect("coin registry lock poisoned").is_empty()
    }

    /// Resolve an incoming API symbol ("btc"/"BTC") to a tracked coin.
    pub fn resolve_symbol(&self, symbol: &str) -> Option<Coin> {
        let needle = symbol.trim();
        self.inner
            .read()
            .expect("coin registry lock poisoned")
            .iter()
            .find(|m| m.coin.symbol.eq_ignore_ascii_case(needle))
            .map(|m| m.coin.clone())
    }
}

impl Default for CoinRegistry {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::entities::Coin;

    fn meta(sym: &str) -> CoinMeta {
        CoinMeta {
            coin: Coin::new(sym.to_lowercase(), sym.to_uppercase(), sym),
            image: None,
            rank: None,
            market_cap: None,
            volume_24h: None,
            change_24h: None,
            circulating_supply: None,
            sparkline_7d: None,
        }
    }

    #[test]
    fn empty_by_default() {
        let r = CoinRegistry::new();
        assert!(r.is_empty());
        assert!(r.coins().is_empty());
    }

    #[test]
    fn replace_then_resolve_case_insensitive() {
        let r = CoinRegistry::new();
        r.replace(vec![meta("BTC"), meta("ETH")]);
        assert!(!r.is_empty());
        assert_eq!(r.coins().len(), 2);
        assert_eq!(r.resolve_symbol("btc").unwrap().symbol(), "BTC");
        assert_eq!(r.resolve_symbol(" Eth ").unwrap().symbol(), "ETH");
        assert!(r.resolve_symbol("doge").is_none());
    }
}
