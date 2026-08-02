import { useMemo } from "react";
import { useLivePrices } from "../hooks/useLivePrices";

export default function TopMetrics() {
  const { prices } = useLivePrices();
  const usd = useMemo(() => prices.filter((p) => p.currency === "USD"), [prices]);
  const avg = usd.length ? usd.reduce((s, p) => s + (p.change24h ?? 0), 0) / usd.length : 0;
  const positive = avg >= 0;
  return (
    <section className="panel grid grid-cols-4 divide-x max-lg:grid-cols-2 max-sm:grid-cols-1" style={{ borderColor: "var(--grid-strong)", borderInlineColor: "var(--grid)" }}>
      <div className="px-6 py-5"><p className="label">Market Cap</p><p className="mt-2 tabular text-xl font-black">$2.45T</p><p className="text-xs font-bold" style={{ color: "var(--color-up)" }}>▲ 1.28%</p></div>
      <div className="px-6 py-5"><p className="label">24H Volume</p><p className="mt-2 tabular text-xl font-black">$98.75B</p><p className="text-xs font-bold" style={{ color: "var(--color-down)" }}>▼ 2.11%</p></div>
      <div className="px-6 py-5"><p className="label">BTC Dominance</p><p className="mt-2 tabular text-xl font-black">52.31%</p><p className="text-xs font-bold" style={{ color: "var(--color-up)" }}>▲ 0.38%</p></div>
      <div className="px-6 py-5"><p className="label">Avg 24H Pulse</p><p className="mt-2 tabular text-xl font-black">{avg.toFixed(2)}%</p><p className="text-xs font-bold" style={{ color: positive ? "var(--color-up)" : "var(--color-down)" }}>{positive ? "Greed" : "Fear"}</p></div>
    </section>
  );
}
