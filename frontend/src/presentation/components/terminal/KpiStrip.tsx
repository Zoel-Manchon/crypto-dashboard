import type { CoinMeta } from "../../../domain/price";
import { compact, dirColor, pct } from "./format";

/** The five numbers that describe the whole tracked market in one strip. */
export default function KpiStrip({ coins }: { coins: CoinMeta[] }) {
  const withCap = coins.filter((c) => (c.marketCap ?? 0) > 0);
  const totalCap = withCap.reduce((a, c) => a + (c.marketCap as number), 0);
  const totalVol = coins.reduce((a, c) => a + (c.volume24h ?? 0), 0);
  const changed = coins.filter((c) => c.change24h !== null);
  const advancers = changed.filter((c) => (c.change24h as number) >= 0).length;
  const decliners = changed.length - advancers;
  const avg = changed.length
    ? changed.reduce((a, c) => a + (c.change24h as number), 0) / changed.length
    : 0;
  const btc = withCap.find((c) => c.symbol === "BTC");
  const dominance = btc && totalCap > 0 ? ((btc.marketCap as number) / totalCap) * 100 : null;

  const kpis = [
    { label: "Tracked mcap", value: compact(totalCap), sub: `${coins.length} pairs` },
    { label: "24h volume", value: compact(totalVol), sub: "spot aggregate" },
    {
      label: "BTC dominance",
      value: dominance === null ? "—" : `${dominance.toFixed(1)}%`,
      sub: "share of tracked",
    },
    {
      label: "Avg 24h",
      value: pct(avg),
      sub: avg >= 0 ? "risk on" : "risk off",
      color: dirColor(avg),
    },
    {
      label: "Breadth",
      value: `${advancers}/${changed.length || coins.length}`,
      sub: "advancing",
      color: advancers >= decliners ? "var(--cw-fg)" : "var(--cw-down)",
    },
  ];

  return (
    <div
      className="grid"
      style={{
        gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
        borderBottom: "2px solid var(--cw-line)",
      }}
    >
      {kpis.map((k) => (
        <div className="cw-kpi" key={k.label}>
          <div className="label">{k.label}</div>
          <div className="cw-kpi__value" style={{ color: k.color ?? "var(--cw-fg)" }}>
            {k.value}
          </div>
          <div
            style={{
              fontSize: 10,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: "var(--cw-dim)",
            }}
          >
            {k.sub}
          </div>
        </div>
      ))}
    </div>
  );
}
