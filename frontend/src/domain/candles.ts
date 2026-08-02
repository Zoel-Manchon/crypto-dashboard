// Pure candle aggregation. No React, no fetch — just the fold from a stream of
// trades into OHLC buckets, so the behaviour the chart depends on is testable
// without a socket.

import type { Candle } from "./price";

/**
 * Folds one trade into a candle series.
 *
 * Returns a NEW array. A trade landing inside the open bucket extends its range
 * and moves the close; a trade past the boundary opens a fresh bucket whose
 * open is the previous close, so the series is continuous instead of gapping at
 * every boundary.
 */
export function foldTick(
  candles: readonly Candle[],
  value: number,
  atMs: number,
  bucketMs: number,
  maxCandles = 40,
): Candle[] {
  if (!Number.isFinite(value) || bucketMs <= 0) return candles.slice();

  const bucketStart = Math.floor(atMs / bucketMs) * bucketMs;
  const next = candles.slice();
  const open = next[next.length - 1];

  if (open && open.t.getTime() === bucketStart) {
    next[next.length - 1] = {
      t: open.t,
      o: open.o,
      h: Math.max(open.h, value),
      l: Math.min(open.l, value),
      c: value,
    };
  } else if (open && open.t.getTime() > bucketStart) {
    // Out-of-order print older than the open bucket: ignore rather than
    // rewriting history — exchanges do occasionally deliver these.
    return next;
  } else {
    const o = open ? open.c : value;
    next.push({
      t: new Date(bucketStart),
      o,
      h: Math.max(o, value),
      l: Math.min(o, value),
      c: value,
    });
  }

  return next.length > maxCandles ? next.slice(next.length - maxCandles) : next;
}
