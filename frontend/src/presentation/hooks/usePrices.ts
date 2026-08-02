import { useEffect, useState } from "react";
import { api } from "../../infrastructure/container";
import type { Price } from "../../domain/price";

interface PricesState {
  prices: Price[];
  loading: boolean;
  error: string | null;
}

/**
 * Presentation hook: fetches latest prices via the application use case
 * (through the container). Never touches fetch or the API URL directly.
 */
export function usePrices() {
  const [state, setState] = useState<PricesState>({
    prices: [],
    loading: true,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;

    api
      .latestPrices()
      .then((prices) => {
        if (!cancelled) setState({ prices, loading: false, error: null });
      })
      .catch((err) => {
        if (!cancelled)
          setState({ prices: [], loading: false, error: String(err) });
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}