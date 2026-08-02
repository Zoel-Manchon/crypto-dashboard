/** Shared number formatting for the terminal. Prices, percentages and compact
 *  magnitudes are read side by side all day, so they format in exactly one place. */

export function usd(n: number): string {
  const a = Math.abs(n);
  const digits = a >= 1000 ? 0 : a >= 1 ? 2 : a >= 0.01 ? 4 : 6;
  return `$${n.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}`;
}

export function pct(n: number): string {
  return `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;
}

export function arrow(n: number): string {
  return `${n >= 0 ? "▲" : "▼"} ${Math.abs(n).toFixed(2)}%`;
}

export function compact(n: number): string {
  const a = Math.abs(n);
  if (a >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (a >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (a >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (a >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

/** Up is lime, down is magenta — the two loudest colours in the palette, and
 *  the only two that ever encode direction. */
export function dirColor(n: number): string {
  return n >= 0 ? "var(--cw-up)" : "var(--cw-down)";
}
