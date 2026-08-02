import { describe, it, expect } from "vitest";
import { colorForSymbol, nameForSymbol } from "./price";

describe("colorForSymbol", () => {
  it("uses brand colors for known tickers (case-insensitive)", () => {
    expect(colorForSymbol("BTC")).toBe("#f7931a");
    expect(colorForSymbol("btc")).toBe("#f7931a");
  });
  it("is deterministic and hsl for unknown tickers", () => {
    expect(colorForSymbol("ZZZ")).toBe(colorForSymbol("ZZZ"));
    expect(colorForSymbol("ZZZ")).toMatch(/^hsl\(/);
  });
});

describe("nameForSymbol", () => {
  it("returns a brand name or the upper-cased symbol", () => {
    expect(nameForSymbol("BTC")).toBe("BITCOIN");
    expect(nameForSymbol("zzz")).toBe("ZZZ");
  });
});
