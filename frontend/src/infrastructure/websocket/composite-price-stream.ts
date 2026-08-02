import type { PriceStream } from "../../application/ports/price-stream";
import type { Price } from "../../domain/price";

/**
 * Third adapter for the PriceStream port: fan-in over several streams.
 *
 * The terminal needs two things at once that no single source gives it:
 *
 *   - the backend WebSocket is the source of truth. It carries every tracked
 *     currency (USD/EUR/JPY/RUB) and matches what's in Postgres — but it only
 *     speaks once per poll cycle, so on its own the screen looks frozen.
 *   - the Binance trade stream is genuinely sub-second, but it only quotes
 *     USDT pairs, which we report as USD.
 *
 * Composing them means USD prices tick continuously while the other currencies
 * still update, and no component downstream has to know there are two sockets.
 * Later sources win on a per-(coin, currency) basis simply by arriving later.
 */
export class CompositePriceStream implements PriceStream {
  constructor(private readonly sources: readonly PriceStream[]) {}

  subscribe(onPrices: (prices: Price[]) => void): () => void {
    const unsubscribes = this.sources.map((s) => s.subscribe(onPrices));
    return () => {
      for (const u of unsubscribes) u();
    };
  }
}
