/**
 * Pearson correlation over price series — pure domain math.
 * Used to measure how closely two coins' 7-day sparklines move together.
 */

/** Pearson r in [-1, 1]; 0 when either series is constant (undefined r). */
export function pearson(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  if (n < 2) return 0;
  // Align on the most recent n points of each series.
  const xs = a.slice(a.length - n);
  const ys = b.slice(b.length - n);
  let sx = 0, sy = 0;
  for (let i = 0; i < n; i++) { sx += xs[i]; sy += ys[i]; }
  const mx = sx / n;
  const my = sy / n;
  let cov = 0, vx = 0, vy = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - mx;
    const dy = ys[i] - my;
    cov += dx * dy;
    vx += dx * dx;
    vy += dy * dy;
  }
  if (vx === 0 || vy === 0) return 0;
  const r = cov / Math.sqrt(vx * vy);
  return Math.max(-1, Math.min(1, r));
}

/** Symmetric correlation matrix with a unit diagonal. */
export function correlationMatrix(series: number[][]): number[][] {
  const n = series.length;
  const m: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    m[i][i] = 1;
    for (let j = i + 1; j < n; j++) {
      const r = pearson(series[i], series[j]);
      m[i][j] = r;
      m[j][i] = r;
    }
  }
  return m;
}
