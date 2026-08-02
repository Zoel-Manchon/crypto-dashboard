import { describe, expect, it } from "vitest";
import { foldTick } from "./candles";
import type { Candle } from "./price";

const BUCKET = 5_000;

describe("foldTick", () => {
  it("opens the first candle at the bucket boundary", () => {
    const out = foldTick([], 100, 12_345, BUCKET);
    expect(out).toHaveLength(1);
    expect(out[0].t.getTime()).toBe(10_000);
    expect(out[0]).toMatchObject({ o: 100, h: 100, l: 100, c: 100 });
  });

  it("extends the open candle within the same bucket", () => {
    let out: Candle[] = foldTick([], 100, 10_000, BUCKET);
    out = foldTick(out, 120, 11_000, BUCKET);
    out = foldTick(out, 90, 12_000, BUCKET);
    out = foldTick(out, 110, 13_000, BUCKET);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ o: 100, h: 120, l: 90, c: 110 });
  });

  it("opens the next candle where the previous one closed", () => {
    let out: Candle[] = foldTick([], 100, 10_000, BUCKET);
    out = foldTick(out, 110, 11_000, BUCKET);
    out = foldTick(out, 130, 16_000, BUCKET);
    expect(out).toHaveLength(2);
    expect(out[1].t.getTime()).toBe(15_000);
    expect(out[1]).toMatchObject({ o: 110, h: 130, l: 110, c: 130 });
  });

  it("ignores prints older than the open bucket", () => {
    let out: Candle[] = foldTick([], 100, 20_000, BUCKET);
    out = foldTick(out, 999, 10_000, BUCKET);
    expect(out).toHaveLength(1);
    expect(out[0].c).toBe(100);
  });

  it("caps the series at maxCandles, dropping the oldest", () => {
    let out: Candle[] = [];
    for (let i = 0; i < 10; i++) out = foldTick(out, 100 + i, i * BUCKET, BUCKET, 4);
    expect(out).toHaveLength(4);
    expect(out[out.length - 1].c).toBe(109);
  });

  it("rejects non-finite prices without corrupting the series", () => {
    let out: Candle[] = foldTick([], 100, 10_000, BUCKET);
    out = foldTick(out, Number.NaN, 11_000, BUCKET);
    expect(out).toHaveLength(1);
    expect(out[0].c).toBe(100);
  });
});
