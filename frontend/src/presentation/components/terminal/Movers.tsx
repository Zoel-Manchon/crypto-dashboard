import type { CoinMeta } from "../../../domain/price";
import { compact, dirColor, pct, usd } from "./format";

/** Movers, sorted by absolute 24h move — biggest story first, either direction. */
export default function Movers({
  coins,
  live,
}: {
  coins: CoinMeta[];
  live: Map<string, number>;
}) {
  const rows = coins
    .filter((c) => c.change24h !== null)
    .slice()
    .sort((a, b) => Math.abs(b.change24h as number) - Math.abs(a.change24h as number))
    .slice(0, 14);

  return (
    <section className="min-w-0">
      <div className="cw-head">
        <span>Movers · 24h</span>
        <span style={{ color: "var(--cw-dim)" }}>by absolute move</span>
      </div>
      <table className="cw-table">
        <thead>
          <tr>
            <th>Pair</th>
            <th style={{ textAlign: "right" }}>Last</th>
            <th style={{ textAlign: "right" }}>24h</th>
            <th style={{ textAlign: "right" }}>Volume</th>
            <th style={{ textAlign: "right" }}>Mcap</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((c) => {
            const chg = c.change24h as number;
            const price = live.get(c.symbol);
            return (
              <tr key={c.symbol}>
                <td style={{ fontWeight: 800 }}>
                  {c.symbol}
                  <span style={{ fontWeight: 400, color: "var(--cw-dim)" }}>/USD</span>
                </td>
                <td style={{ textAlign: "right" }}>{price === undefined ? "—" : usd(price)}</td>
                <td style={{ textAlign: "right", fontWeight: 800, color: dirColor(chg) }}>
                  {pct(chg)}
                </td>
                <td style={{ textAlign: "right", color: "var(--cw-dim)" }}>
                  {c.volume24h ? compact(c.volume24h) : "—"}
                </td>
                <td style={{ textAlign: "right", color: "var(--cw-dim)" }}>
                  {c.marketCap ? compact(c.marketCap) : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
