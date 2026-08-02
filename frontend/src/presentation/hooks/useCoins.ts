import { useEffect, useState } from "react";
import { api } from "../../infrastructure/container";
import { type CoinMeta, colorForSymbol, nameForSymbol } from "../../domain/price";

// Shared module-level cache: every island fetches the coin list at most once.
let cache: CoinMeta[] | null = null;
let inflight: Promise<CoinMeta[]> | null = null;

// If /api/coins is unreachable (older backend, offline), fall back to the
// classic set so the UI still renders something sensible.
const FALLBACK_SYMBOLS = [
  "BTC", "ETH", "SOL", "LTC", "BNB",
  "XRP", "ADA", "DOGE", "AVAX", "DOT",
  "LINK", "BCH", "TRX", "MATIC", "SHIB",
];

function fallbackCoins(): CoinMeta[] {
  return FALLBACK_SYMBOLS.map((symbol, i) => ({
    symbol,
    name: nameForSymbol(symbol),
    id: symbol.toLowerCase(),
    image: null,
    rank: i + 1,
    color: colorForSymbol(symbol),
    marketCap: null,
    volume24h: null,
    change24h: null,
    circulatingSupply: null,
    sparkline7d: null,
  }));
}

function load(): Promise<CoinMeta[]> {
  if (cache) return Promise.resolve(cache);
  if (!inflight) {
    inflight = api
      .coins()
      .then((list) => {
        cache = list.length > 0 ? list : fallbackCoins();
        return cache;
      })
      .catch(() => {
        cache = fallbackCoins();
        return cache;
      });
  }
  return inflight;
}

export interface CoinsState {
  coins: CoinMeta[];
  symbols: string[];
  bySymbol: Record<string, CoinMeta>;
  loading: boolean;
}

/** Loads the live coin registry once and shares it across all components. */
export function useCoins(): CoinsState {
  const [coins, setCoins] = useState<CoinMeta[]>(cache ?? []);
  const [loading, setLoading] = useState<boolean>(cache === null);

  useEffect(() => {
    if (cache) {
      setCoins(cache);
      setLoading(false);
      return;
    }
    let cancelled = false;
    load().then((list) => {
      if (!cancelled) {
        setCoins(list);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const bySymbol: Record<string, CoinMeta> = {};
  for (const c of coins) bySymbol[c.symbol] = c;

  return { coins, symbols: coins.map((c) => c.symbol), bySymbol, loading };
}
