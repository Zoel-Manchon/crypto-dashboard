import { useEffect, useMemo, useState } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useAllSeries } from "../hooks/UseAllSeries";

function cssVar(name: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}
function fmtTime(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(iso));
}

export default function HeroTradeChart() {
  const { series, loading, error } = useAllSeries(["BTC"], "USD", "day");
  const btc = series.find((s) => s.coin === "BTC");
  const data = useMemo(() => (btc?.points ?? []).map((p, i) => ({ t: p.observedAt.toISOString(), v: Number(p.value), vol: 30 + ((i * 17) % 65) })), [btc]);
  const latest = data.at(-1)?.v ?? null;
  const first = data.at(0)?.v ?? latest;
  const change = latest && first ? ((latest - first) / first) * 100 : -2.97;
  const [colors, setColors] = useState({ grid: "#162841", text: "#9aa8bd" });
  useEffect(() => { const r = () => setColors({ grid: cssVar("--grid", "#162841"), text: cssVar("--text-dim", "#9aa8bd") }); r(); const o = new MutationObserver(r); o.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] }); return () => o.disconnect(); }, []);

  return (
    <section className="panel px-5 py-5">
      <div className="mb-3 flex items-start justify-between">
        <div><p className="text-sm font-black">BTC / USD</p><p className="tabular text-3xl font-black">{latest ? `$${latest.toLocaleString("en-US", { maximumFractionDigits: 2 })}` : "$61,275.00"} <span className="text-sm" style={{ color: change >= 0 ? "var(--color-up)" : "var(--color-down)" }}>{change >= 0 ? "▲" : "▼"} {Math.abs(change).toFixed(2)}% (24H)</span></p></div>
        <div className="flex gap-1">{["1H", "4H", "1D", "1W", "1M", "1Y"].map((p) => <button key={p} className={`neon-button px-3 py-2 text-xs font-bold ${p === "1D" ? "active" : ""}`}>{p}</button>)}</div>
      </div>
      {loading ? <span className="shimmer block h-[290px] rounded" /> : error ? <p style={{ color: "var(--color-down)" }}>CHART ERROR — {error}</p> : <>
        <ResponsiveContainer width="100%" height={240}>
          <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <defs><linearGradient id="redGlow" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#ff4560" stopOpacity={0.28}/><stop offset="95%" stopColor="#ff4560" stopOpacity={0}/></linearGradient></defs>
            <CartesianGrid stroke={colors.grid} strokeDasharray="2 4" />
            <XAxis dataKey="t" tickFormatter={fmtTime} tick={{ fill: colors.text, fontSize: 11 }} stroke={colors.grid} minTickGap={42} />
            <YAxis domain={["auto", "auto"]} tick={{ fill: colors.text, fontSize: 11 }} stroke={colors.grid} width={64} tickFormatter={(v) => `$${Number(v).toLocaleString()}`} />
            <Tooltip contentStyle={{ background: "var(--bg-row)", border: `1px solid ${colors.grid}`, color: "var(--text)" }} labelFormatter={(l) => fmtTime(String(l))} formatter={(v) => [`$${Number(v).toLocaleString()}`, "BTC"]} />
            <Area type="monotone" dataKey="v" stroke="#ff4560" fill="url(#redGlow)" strokeWidth={2} dot={false} isAnimationActive={false} />
          </AreaChart>
        </ResponsiveContainer>
        <ResponsiveContainer width="100%" height={55}>
          <BarChart data={data}><Bar dataKey="vol" fill="rgba(154,168,189,.22)" isAnimationActive={false} /></BarChart>
        </ResponsiveContainer>
      </>}
    </section>
  );
}
