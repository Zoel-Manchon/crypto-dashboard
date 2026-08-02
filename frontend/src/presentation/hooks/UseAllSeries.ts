import { useEffect, useState } from "react";
import { api, priceStream } from "../../infrastructure/container";
import type { Coin, Currency, Period, PricePoint } from "../../domain/price";

export interface CoinSeries {
  coin: Coin;
  points: PricePoint[];
}

interface SeriesState {
  series: CoinSeries[];
  loading: boolean;
  error: string | null;
}

/**
 * Fetches the price series for the given coins (one currency, one period) in
 * parallel, then keeps them moving via the WebSocket stream. The coin list is
 * passed in so callers decide how many coins to load (one for the detail chart,
 * a handful for the relative-performance overlay) — important now that the
 * tracked set can be large.
 */
export function useAllSeries(coins: readonly Coin[], currency: Currency, period: Period) {
  const [state, setState] = useState<SeriesState>({
    series: [],
    loading: true,
    error: null,
  });

  // Stable dependency key so the effect re-runs when the coin set changes.
  const coinsKey = coins.join(",");

  useEffect(() => {
    let cancelled = false;
    setState((s) => ({ ...s, loading: true }));

    if (coins.length === 0) {
      setState({ series: [], loading: false, error: null });
      return;
    }

    Promise.all(
      coins.map((coin) =>
        api.series(coin, currency, period).then((points) => ({ coin, points })),
      ),
    )
      .then((series) => {
        if (!cancelled) setState({ series, loading: false, error: null });
      })
      .catch((err) => {
        if (!cancelled) setState({ series: [], loading: false, error: String(err) });
      });

    const wanted = new Set<Coin>(coins);
    const unsubscribe = priceStream.subscribe((prices) => {
      if (cancelled) return;
      const incoming = prices.filter((p) => p.currency === currency && wanted.has(p.coin));
      if (incoming.length === 0) return;

      setState((current) => {
        const byCoin = new Map(current.series.map((s) => [s.coin, s]));

        for (const price of incoming) {
          const existing = byCoin.get(price.coin) ?? { coin: price.coin, points: [] };
          const nextPoint = { value: price.value, observedAt: price.observedAt };
          const previous = existing.points[existing.points.length - 1];

          const points =
            previous?.observedAt.getTime() === nextPoint.observedAt.getTime()
              ? [...existing.points.slice(0, -1), nextPoint]
              : [...existing.points, nextPoint];

          byCoin.set(price.coin, { coin: price.coin, points: points.slice(-1500) });
        }

        return { ...current, series: coins.map((coin) => byCoin.get(coin) ?? { coin, points: [] }) };
      });
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coinsKey, currency, period]);

  return state;
}
