import type { Price } from "../../domain/price";

/** Port: live price feed (#7). Infrastructure implements this. */
export interface PriceStream {
  /** Subscribe to live batches. Returns an unsubscribe function. */
  subscribe(onPrices: (prices: Price[]) => void): () => void;
}