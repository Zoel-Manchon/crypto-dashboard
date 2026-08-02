import { useEffect, useState } from "react";
import { api, priceStream } from "../../infrastructure/container";
import type { Price } from "../../domain/price";

interface LivePricesState {
  prices: Price[];
  loading: boolean;
  error: string | null;
  live: boolean; // true once at least one WebSocket batch has arrived
}

/** Stable key for a coin+currency pair, used to merge live updates. */
function keyOf(p: Price): string {
  return `${p.coin}:${p.currency}`;
}

/**
 * Loads latest prices once (so cards aren't empty on first paint), then
 * subscribes to the live price stream and merges each broadcast batch.
 * Flows entirely through the container — no direct fetch or WebSocket here.
 */
export function useLivePrices() {
  const [state, setState] = useState<LivePricesState>({
    prices: [],
    loading: true,
    error: null,
    live: false,
  });

  useEffect(() => {
    let cancelled = false;

    // 1) Initial snapshot via the REST use case.
    api
      .latestPrices()
      .then((prices) => {
        if (!cancelled)
          setState((s) => ({ ...s, prices, loading: false, error: null }));
      })
      .catch((err) => {
        if (!cancelled)
          setState((s) => ({ ...s, loading: false, error: String(err) }));
      });

    // 2) Subscribe to live updates. Each batch replaces matching pairs.
    const unsubscribe = priceStream.subscribe((incoming: Price[]) => {
      if (cancelled) return;
      setState((s) => {
        const merged = new Map(s.prices.map((p) => [keyOf(p), p]));
        for (const p of incoming) merged.set(keyOf(p), p);
        return {
          ...s,
          prices: Array.from(merged.values()),
          loading: false,
          live: true,
        };
      });
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  return state;
}