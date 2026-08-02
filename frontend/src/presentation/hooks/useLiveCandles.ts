import { useEffect, useRef, useState } from "react";
import { priceStream } from "../../infrastructure/container";
import type { Candle, Coin } from "../../domain/price";
import { foldTick } from "../../domain/candles";

/**
 * Candles built from the live tape.
 *
 * The stored `/api/prices/ohlc` series is only as dense as the backend's poll
 * interval — a minute apart at best, and empty on a fresh database, which is
 * why the chart used to render nothing.
 *
 * It is deliberately NOT used as a seed here. Mixing hour-wide stored candles
 * with 5-second live ones produced a chart whose axis claimed a 12-hour span
 * while the bucket selector said "5S" — every candle the same width, two
 * different meanings. A time axis that lies is worse than a chart that takes
 * three minutes to fill, so this hook only ever holds buckets of one width.
 *
 * `seedPrice` opens the first candle immediately from the last known price, so
 * there's a mark on screen before the first trade lands.
 */
export function useLiveCandles(
  coin: Coin,
  bucketMs: number,
  seedPrice?: number,
  maxCandles = 40,
) {
  const [candles, setCandles] = useState<Candle[]>([]);
  const ref = useRef<Candle[]>([]);
  const seededRef = useRef(false);

  // Reset whenever the watched pair or the bucket width changes — mixing two
  // bucket widths in one array would silently lie about the time axis.
  useEffect(() => {
    ref.current = [];
    seededRef.current = false;
    setCandles([]);
  }, [coin, bucketMs]);

  // Open the first bucket from the last known price so the panel isn't blank
  // while waiting for the first trade to print.
  useEffect(() => {
    if (seededRef.current || !coin || seedPrice === undefined || !Number.isFinite(seedPrice)) return;
    seededRef.current = true;
    ref.current = foldTick([], seedPrice, Date.now(), bucketMs, maxCandles);
    setCandles(ref.current);
  }, [coin, bucketMs, seedPrice, maxCandles]);

  // Fold live trades into the open bucket. The fold itself lives in
  // domain/candles.ts and is unit-tested there; this effect only wires it to
  // the stream.
  useEffect(() => {
    if (!coin) return;
    const unsubscribe = priceStream.subscribe((prices) => {
      const hit = prices.find((p) => p.coin === coin && p.currency === "USD");
      if (!hit) return;
      const next = foldTick(
        ref.current,
        Number(hit.value),
        hit.observedAt.getTime(),
        bucketMs,
        maxCandles,
      );
      if (next === ref.current) return;
      ref.current = next;
      setCandles(next);
    });
    return unsubscribe;
  }, [coin, bucketMs, maxCandles]);

  return { candles };
}
