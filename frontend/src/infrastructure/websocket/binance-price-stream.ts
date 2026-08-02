import type { PriceStream } from "../../application/ports/price-stream";
import type { Price } from "../../domain/price";
import { BINANCE_WS_URL } from "../config";
import { isFeedPaused } from "./feed-gate";

/**
 * Second adapter for the PriceStream port: live trades streamed directly from
 * Binance's public combined-stream WebSocket (no API key required).
 *
 * Where the backend adapter emits one batch per poll cycle, this one delivers
 * real sub-second exchange trades. Both implement the same port, so the
 * presentation layer can swap them freely — ports and adapters in action.
 *
 * Notes:
 * - Pairs are quoted in USDT and reported as USD (a ~1:1 proxy).
 * - Symbols without a USDT pair on Binance simply never emit (Binance ignores
 *   unknown stream names in a combined URL).
 * - Trades are coalesced per symbol and flushed once per animation frame, so a
 *   busy pair that prints hundreds of trades a second still costs at most one
 *   React render per frame. That is the real ceiling: the browser cannot paint
 *   faster than the display refreshes, so flushing more often would burn CPU
 *   without changing a single pixel.
 */
export class BinancePriceStream implements PriceStream {
  constructor(private readonly getSymbols: () => Promise<string[]>) {}

  subscribe(onPrices: (prices: Price[]) => void): () => void {
    // Background tabs get no animation frames, so fall back to a timer there —
    // otherwise the buffer would grow unbounded while the tab is hidden.
    const FALLBACK_MS = 200;
    let ws: WebSocket | null = null;
    let stopped = false;
    let attempt = 0;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let frame: number | null = null;
    let fallbackTimer: ReturnType<typeof setInterval> | null = null;
    const pending = new Map<string, Price>();

    const flush = () => {
      if (isFeedPaused()) return;
      if (pending.size > 0) {
        const batch = Array.from(pending.values());
        pending.clear();
        onPrices(batch);
      }
    };

    const tick = () => {
      if (stopped) return;
      flush();
      frame = requestAnimationFrame(tick);
    };

    if (typeof requestAnimationFrame === "function") {
      frame = requestAnimationFrame(tick);
      // rAF stops in a hidden tab; drain on a timer until it comes back.
      fallbackTimer = setInterval(() => {
        if (document.hidden) flush();
      }, FALLBACK_MS);
    } else {
      fallbackTimer = setInterval(flush, FALLBACK_MS);
    }

    const connect = async () => {
      if (stopped) return;
      let symbols: string[] = [];
      try {
        symbols = await this.getSymbols();
      } catch {
        scheduleReconnect();
        return;
      }
      const streams = symbols
        .filter((s) => s.toUpperCase() !== "USDT") // can't trade USDT/USDT
        .map((s) => `${s.toLowerCase()}usdt@trade`)
        .join("/");
      if (!streams || stopped) return;

      ws = new WebSocket(`${BINANCE_WS_URL}/stream?streams=${streams}`);

      ws.onopen = () => {
        attempt = 0;
      };
      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          const d = msg?.data;
          if (!d || d.e !== "trade") return;
          const coin = String(d.s).replace(/USDT$/, "");
          pending.set(coin, {
            coin,
            currency: "USD",
            value: String(d.p),
            observedAt: new Date(d.T ?? Date.now()),
            change24h: null,
          });
        } catch {
          // Ignore malformed frames.
        }
      };
      ws.onclose = () => scheduleReconnect();
      ws.onerror = () => ws?.close();
    };

    const scheduleReconnect = () => {
      if (stopped) return;
      attempt += 1;
      const delay = Math.min(30_000, 1000 * 2 ** (attempt - 1));
      reconnectTimer = setTimeout(() => void connect(), delay);
    };

    void connect();

    return () => {
      stopped = true;
      if (frame !== null) cancelAnimationFrame(frame);
      if (fallbackTimer) clearInterval(fallbackTimer);
      if (reconnectTimer) clearTimeout(reconnectTimer);
      ws?.close();
    };
  }
}
