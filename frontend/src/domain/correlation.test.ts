import { describe, it, expect } from "vitest";
import { pearson, correlationMatrix } from "./correlation";

describe("pearson", () => {
  it("is 1 for identical series and -1 for inverted", () => {
    const a = [1, 2, 3, 5, 8, 13];
    expect(pearson(a, a)).toBeCloseTo(1, 10);
    expect(pearson(a, a.map((v) => -v))).toBeCloseTo(-1, 10);
  });
  it("is 0 for a constant series", () => {
    expect(pearson([4, 4, 4, 4], [1, 2, 3, 4])).toBe(0);
  });
  it("aligns on the most recent overlap when lengths differ", () => {
    // Overlapping tail is identical -> perfectly correlated.
    expect(pearson([9, 9, 1, 2, 3], [1, 2, 3])).toBeCloseTo(1, 10);
  });
});

describe("correlationMatrix", () => {
  it("is symmetric with a unit diagonal", () => {
    const m = correlationMatrix([
      [1, 2, 3, 4],
      [2, 4, 6, 8],
      [4, 3, 2, 1],
    ]);
    expect(m[0][0]).toBe(1);
    expect(m[1][1]).toBe(1);
    expect(m[0][1]).toBeCloseTo(1, 10); // scaled copy
    expect(m[0][2]).toBeCloseTo(-1, 10); // inverted
    expect(m[0][1]).toBe(m[1][0]);
    expect(m[1][2]).toBe(m[2][1]);
  });
});
