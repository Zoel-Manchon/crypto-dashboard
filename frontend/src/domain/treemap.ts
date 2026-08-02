export interface TreemapRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Squarified treemap layout (Bruls, Huizing & van Wijk, 2000).
 *
 * Takes weights sorted in DESCENDING order and a container rectangle, and
 * returns one rectangle per weight (same order) tiling the container, chosen
 * so cell aspect ratios stay as close to 1 as possible.
 */
export function squarify(
  weights: number[],
  container: TreemapRect,
): TreemapRect[] {
  const total = weights.reduce((a, b) => a + b, 0);
  if (total <= 0 || weights.length === 0) return [];

  // Scale weights so they sum to the container's area.
  const scale = (container.w * container.h) / total;
  const areas = weights.map((v) => Math.max(v, 0) * scale);

  const out: TreemapRect[] = [];
  let { x, y, w, h } = container;
  let i = 0;

  while (i < areas.length) {
    const side = Math.min(w, h);

    // Greedily grow the current row while the worst aspect ratio improves.
    let row = [areas[i]];
    let best = worstAspect(row, side);
    let j = i + 1;
    while (j < areas.length) {
      const candidate = worstAspect([...row, areas[j]], side);
      if (candidate <= best) {
        row.push(areas[j]);
        best = candidate;
        j += 1;
      } else {
        break;
      }
    }

    const rowSum = row.reduce((a, b) => a + b, 0);
    const thickness = side > 0 ? rowSum / side : 0;

    if (w <= h) {
      // Lay the row horizontally across the top, then shrink downward.
      let cx = x;
      for (const a of row) {
        const cw = thickness > 0 ? a / thickness : 0;
        out.push({ x: cx, y, w: cw, h: thickness });
        cx += cw;
      }
      y += thickness;
      h = Math.max(0, h - thickness);
    } else {
      // Lay the row vertically along the left, then shrink rightward.
      let cy = y;
      for (const a of row) {
        const ch = thickness > 0 ? a / thickness : 0;
        out.push({ x, y: cy, w: thickness, h: ch });
        cy += ch;
      }
      x += thickness;
      w = Math.max(0, w - thickness);
    }

    i = j;
  }

  return out;
}

/** Worst (largest) aspect ratio a row would have if laid along `side`. */
function worstAspect(row: number[], side: number): number {
  const sum = row.reduce((a, b) => a + b, 0);
  if (sum <= 0 || side <= 0) return Infinity;
  const max = Math.max(...row);
  const min = Math.min(...row);
  const s2 = sum * sum;
  const side2 = side * side;
  return Math.max((side2 * max) / s2, s2 / (side2 * min));
}
