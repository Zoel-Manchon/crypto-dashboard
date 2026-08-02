import type { CoinMeta } from "../../../domain/price";
import { dirColor, pct, usd } from "./format";

/** Compresses a 7d sparkline into 24 bars scaled to the panel row height. */
function bars(series: number[] | null): number[] {
  if (!series || series.length < 2) return [];
  const step = Math.max(1, Math.floor(series.length / 24));
  const pts: number[] = [];
  for (let i = 0; i < series.length; i += step) pts.push(series[i]);
  const tail = pts.slice(-24);
  const mn = Math.min(...tail);
  const mx = Math.max(...tail);
  const span = mx - mn || 1;
  return tail.map((v) => 12 + ((v - mn) / span) * 88);
}

/**
 * The watchlist. Rows are buttons: clicking one re-points the hero, the candles
 * and the realtime chart at that pair — the selection is the terminal's single
 * piece of shared state.
 */
export default function Watchlist({
  coins,
  live,
  selected,
  onSelect,
}: {
  coins: CoinMeta[];
  live: Map<string, number>;
  selected: string;
  onSelect: (symbol: string) => void;
}) {
  return (
    <section className="min-w-0">
      <div className="cw-head">
        <span>Watchlist</span>
        <span style={{ color: "var(--cw-dim)" }}>{coins.length} pairs</span>
      </div>
      <div style={{ maxHeight: 468, overflowY: "auto" }}>
        {coins.map((c) => {
          const isSel = c.symbol === selected;
          const chg = c.change24h ?? 0;
          const price = live.get(c.symbol);
          const spark = bars(c.sparkline7d);
          const barColor = isSel ? "var(--cw-on-accent)" : dirColor(chg);
          return (
            <button
              key={c.symbol}
              onClick={() => onSelect(c.symbol)}
              aria-pressed={isSel}
              className="grid w-full items-center text-left"
              style={{
                gridTemplateColumns: "52px 1fr 72px 62px",
                gap: 8,
                padding: "8px 14px",
                border: 0,
                borderBottom: "1px solid var(--cw-grid)",
                cursor: "pointer",
                background: isSel ? "var(--cw-accent)" : "transparent",
                color: isSel ? "var(--cw-on-accent)" : "var(--cw-fg)",
              }}
            >
              <span style={{ fontWeight: 800, fontSize: 12, letterSpacing: "0.06em" }}>
                {c.symbol}
              </span>
              <span className="flex items-end gap-px" style={{ height: 22 }}>
                {spark.map((h, i) => (
                  <span key={i} style={{ flex: 1, height: `${h}%`, background: barColor }} />
                ))}
              </span>
              <span style={{ fontSize: 12, textAlign: "right" }}>
                {price === undefined ? "—" : usd(price)}
              </span>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 800,
                  textAlign: "right",
                  color: isSel ? "var(--cw-on-accent)" : dirColor(chg),
                }}
              >
                {pct(chg)}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
