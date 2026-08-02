import type { PriceStream } from "../../application/ports/price-stream";
import type { Price } from "../../domain/price";
import { WS_URL } from "../config";
import { toPrice, type PriceDto } from "../dto/price-dto";
import { isFeedPaused } from "./feed-gate";

/**
 * Live price feed over WebSocket, with automatic reconnect + exponential
 * backoff. The socket silently dropping (server restart, network blip) no
 * longer kills the stream — it reconnects until the caller unsubscribes.
 *
 * Honours the global feed gate: while held, frames are read and dropped rather
 * than delivered, so the connection stays warm (see feed-gate.ts).
 */
export class WebSocketPriceStream implements PriceStream {
  subscribe(onPrices: (prices: Price[]) => void): () => void {
    let ws: WebSocket | null = null;
    let stopped = false;
    let attempt = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      if (stopped) return;
      ws = new WebSocket(WS_URL);

      ws.onopen = () => {
        attempt = 0; // reset backoff on a healthy connection
      };
      ws.onmessage = (event) => {
        if (isFeedPaused()) return;
        try {
          const dtos: PriceDto[] = JSON.parse(event.data);
          onPrices(dtos.map(toPrice));
        } catch {
          // Ignore malformed frames.
        }
      };
      ws.onclose = () => scheduleReconnect();
      ws.onerror = () => ws?.close(); // surfaces as onclose -> reconnect
    };

    const scheduleReconnect = () => {
      if (stopped) return;
      attempt += 1;
      const delay = Math.min(30_000, 1000 * 2 ** (attempt - 1)); // 1s,2s,4s… cap 30s
      timer = setTimeout(connect, delay);
    };

    connect();

    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      ws?.close();
    };
  }
}
