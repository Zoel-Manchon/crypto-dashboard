import { describe, it, expect } from "vitest";
import { toPrice, toCoinMeta, toCandle } from "./price-dto";

describe("toPrice", () => {
  it("maps a price dto", () => {
    const p = toPrice({ coin: "BTC", currency: "USD", value: "123.45", observed_at: "2026-01-01T00:00:00Z", change_24h: 1.2 });
    expect(p.coin).toBe("BTC");
    expect(p.value).toBe("123.45");
    expect(p.change24h).toBe(1.2);
    expect(p.observedAt).toBeInstanceOf(Date);
  });
  it("defaults a missing 24h change to null", () => {
    const p = toPrice({ coin: "ETH", currency: "EUR", value: "1", observed_at: "2026-01-01T00:00:00Z" });
    expect(p.change24h).toBeNull();
  });
});

describe("toCoinMeta", () => {
  it("uppercases symbol, adds color, maps market fields", () => {
    const m = toCoinMeta({ symbol: "btc", name: "Bitcoin", id: "bitcoin", image: null, rank: 1, market_cap: 5, sparkline_7d: [1, 2, 3] });
    expect(m.symbol).toBe("BTC");
    expect(m.color).toBe("#f7931a");
    expect(m.marketCap).toBe(5);
    expect(m.sparkline7d).toEqual([1, 2, 3]);
    expect(m.volume24h).toBeNull();
  });
});

describe("toCandle", () => {
  it("parses OHLC numbers and the bucket date", () => {
    const c = toCandle({ t: "2026-01-01T00:00:00Z", o: "1", h: "3", l: "0.5", c: "2" });
    expect([c.o, c.h, c.l, c.c]).toEqual([1, 3, 0.5, 2]);
    expect(c.t).toBeInstanceOf(Date);
  });
});
