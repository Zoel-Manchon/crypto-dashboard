import { useEffect, useState } from "react";
import { api } from "../../infrastructure/container";
import type { Coin, Currency, Period, PriceExtremes } from "../../domain/price";

interface ExtremesState {
  extremes: PriceExtremes[];
  loading: boolean;
  error: string | null;
}

/**
 * Fetches highest/lowest for the given coins (in one currency) over a period.
 * The coin list is supplied by the caller (from the live registry).
 */
export function useExtremes(coins: readonly Coin[], currency: Currency, period: Period) {
  const [state, setState] = useState<ExtremesState>({
    extremes: [],
    loading: true,
    error: null,
  });

  const coinsKey = coins.join(",");

  useEffect(() => {
    let cancelled = false;
    setState((s) => ({ ...s, loading: true }));

    if (coins.length === 0) {
      setState({ extremes: [], loading: false, error: null });
      return;
    }

    Promise.all(coins.map((coin) => api.extremes(coin, currency, period)))
      .then((results) => {
        if (cancelled) return;
        const extremes = results.filter((r): r is PriceExtremes => r !== null);
        setState({ extremes, loading: false, error: null });
      })
      .catch((err) => {
        if (!cancelled) setState({ extremes: [], loading: false, error: String(err) });
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coinsKey, currency, period]);

  return state;
}
