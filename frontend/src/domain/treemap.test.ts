import { describe, it, expect } from "vitest";
import { squarify, type TreemapRect } from "./treemap";

const box: TreemapRect = { x: 0, y: 0, w: 600, h: 400 };

describe("squarify", () => {
  it("returns one rect per weight and preserves order", () => {
    const rects = squarify([50, 30, 15, 5], box);
    expect(rects).toHaveLength(4);
    // Largest weight gets the largest area, in input (descending) order.
    const areas = rects.map((r) => r.w * r.h);
    for (let i = 1; i < areas.length; i++) expect(areas[i - 1]).toBeGreaterThanOrEqual(areas[i] - 1e-6);
  });

  it("tiles the full container area", () => {
    const rects = squarify([8, 5, 3, 2, 1, 1], box);
    const total = rects.reduce((a, r) => a + r.w * r.h, 0);
    expect(total).toBeCloseTo(box.w * box.h, 4);
  });

  it("keeps every rect inside the container", () => {
    const rects = squarify([13, 8, 8, 4, 3, 2, 1], box);
    for (const r of rects) {
      expect(r.x).toBeGreaterThanOrEqual(-1e-6);
      expect(r.y).toBeGreaterThanOrEqual(-1e-6);
      expect(r.x + r.w).toBeLessThanOrEqual(box.w + 1e-6);
      expect(r.y + r.h).toBeLessThanOrEqual(box.h + 1e-6);
    }
  });

  it("handles empty and zero-total input", () => {
    expect(squarify([], box)).toEqual([]);
    expect(squarify([0, 0], box)).toEqual([]);
  });
});
