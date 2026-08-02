import { describe, it, expect } from "vitest";
import { sma, ema, rsi, bollinger, volatility, totalReturn } from "./indicators";

describe("sma", () => {
  it("averages over the window with null warm-up", () => {
    expect(sma([1, 2, 3, 4, 5], 3)).toEqual([null, null, 2, 3, 4]);
  });
});

describe("ema", () => {
  it("stays constant on a constant series", () => {
    const out = ema([5, 5, 5, 5, 5, 5], 3);
    expect(out.slice(0, 2)).toEqual([null, null]);
    for (const v of out.slice(2)) expect(v).toBeCloseTo(5, 10);
  });
  it("seeds with the SMA of the first window", () => {
    const out = ema([1, 2, 3, 4], 3);
    expect(out[2]).toBeCloseTo(2); // (1+2+3)/3
    expect(out[3]).toBeCloseTo(4 * 0.5 + 2 * 0.5); // k = 2/(3+1)
  });
});

describe("rsi", () => {
  it("is 100 on a strictly rising series", () => {
    const out = rsi([1, 2, 3, 4, 5, 6, 7], 3);
    for (const v of out.slice(3)) expect(v).toBe(100);
  });
  it("is ~50 on a perfectly alternating series", () => {
    const vals = [10, 11, 10, 11, 10, 11, 10, 11, 10, 11];
    const out = rsi(vals, 4);
    const last = out[out.length - 1];
    expect(last).not.toBeNull();
    expect(Math.abs((last as number) - 50)).toBeLessThan(15);
  });
});

describe("bollinger", () => {
  it("collapses to the mid on a constant series", () => {
    const { mid, upper, lower } = bollinger([4, 4, 4, 4, 4], 3, 2);
    expect(mid[4]).toBeCloseTo(4);
    expect(upper[4]).toBeCloseTo(4);
    expect(lower[4]).toBeCloseTo(4);
  });
  it("is symmetric around the mid", () => {
    const { mid, upper, lower } = bollinger([1, 2, 3, 4, 5, 6], 4, 2);
    const i = 5;
    expect((upper[i]! + lower[i]!) / 2).toBeCloseTo(mid[i]!);
    expect(upper[i]!).toBeGreaterThan(mid[i]!);
  });
});

describe("volatility", () => {
  it("is 0 for a constant series", () => {
    expect(volatility([5, 5, 5, 5, 5])).toBe(0);
  });
  it("grows with swing size", () => {
    const calm = volatility([100, 101, 100, 101, 100, 101]);
    const wild = volatility([100, 120, 95, 130, 90, 125]);
    expect(wild).toBeGreaterThan(calm);
    expect(calm).toBeGreaterThan(0);
  });
});

describe("totalReturn", () => {
  it("computes first-to-last % change", () => {
    expect(totalReturn([100, 150, 110])).toBeCloseTo(10);
    expect(totalReturn([100, 80])).toBeCloseTo(-20);
    expect(totalReturn([5])).toBe(0);
  });
});
