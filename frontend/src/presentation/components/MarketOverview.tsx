import { useMemo, useState } from "react";
import { useCoins } from "../hooks/useCoins";
import { colorForSymbol } from "../../domain/price";

const DONUT_SLICES = 8; // top N shown individually; the rest folds into OTHER

function fmtCompact(n: number): string {
  const a = Math.abs(n);
  if (a >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (a >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (a >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  return `$${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="border px-3 py-2" style={{ borderColor: "var(--grid)", backgroundColor: "var(--bg-row)" }}>
      <div className="label" style={{ color: "var(--text-faint)" }}>{label}</div>
      <div className="tabular text-sm font-bold" style={{ color: color ?? "var(--text)" }}>{value}</div>
    </div>
  );
}

export default function MarketOverview() {
  const { coins, loading } = useCoins();
  const [hover, setHover] = useState<string | null>(null);

  const stats = useMemo(() => {
    const withCap = coins.filter((c) => (c.marketCap ?? 0) > 0);
    const totalMcap = withCap.reduce((a, c) => a + (c.marketCap as number), 0);
    const totalVol = coins.reduce((a, c) => a + (c.volume24h ?? 0), 0);
    const changed = coins.filter((c) => c.change24h !== null);
    const advancers = changed.filter((c) => (c.change24h as number) >= 0).length;
    const decliners = changed.length - advancers;
    const avgChange = changed.length
      ? changed.reduce((a, c) => a + (c.change24h as number), 0) / changed.length
      : 0;

    const sorted = withCap.slice().sort((a, b) => (b.marketCap as number) - (a.marketCap as number));
    const top = sorted.slice(0, DONUT_SLICES);
    const otherCap = sorted.slice(DONUT_SLICES).reduce((a, c) => a + (c.marketCap as number), 0);
    const slices = [
      ...top.map((c) => ({
        symbol: c.symbol,
        cap: c.marketCap as number,
        color: colorForSymbol(c.symbol),
      })),
      ...(otherCap > 0 ? [{ symbol: "OTHER", cap: otherCap, color: "#3a4150" }] : []),
    ];
    const btc = sorted.find((c) => c.symbol === "BTC");
    const dominance = btc && totalMcap > 0 ? ((btc.marketCap as number) / totalMcap) * 100 : null;

    return { totalMcap, totalVol, advancers, decliners, avgChange, slices, dominance };
  }, [coins]);

  const { slices, totalMcap } = stats;
  const R = 62;
  const STROKE = 26;
  const C = 2 * Math.PI * R;
  let acc = 0;

  const breadthTotal = stats.advancers + stats.decliners;
  const upFrac = breadthTotal > 0 ? stats.advancers / breadthTotal : 0.5;

  if (loading && coins.length === 0) {
    return (
      <div className="border p-3" style={{ borderColor: "var(--grid-strong)", backgroundColor: "var(--bg-panel)" }}>
        <span className="shimmer block h-[220px] w-full rounded" />
      </div>
    );
  }

  return (
    <div className="border" style={{ borderColor: "var(--grid-strong)", backgroundColor: "var(--bg-panel)" }}>
      <div className="grid gap-4 px-4 py-4 md:grid-cols-[220px_1fr]">
        {/* dominance donut */}
        <div className="flex items-center justify-center">
          <svg viewBox="0 0 180 180" width={190} height={190} role="img" aria-label="Market cap share">
            <g transform="rotate(-90 90 90)">
              {slices.map((s) => {
                const frac = totalMcap > 0 ? s.cap / totalMcap : 0;
                const dash = `${frac * C} ${C}`;
                const offset = -acc * C;
                acc += frac;
                const dim = hover !== null && hover !== s.symbol;
                return (
                  <circle
                    key={s.symbol}
                    cx={90}
                    cy={90}
                    r={R}
                    fill="none"
                    stroke={s.color}
                    strokeWidth={hover === s.symbol ? STROKE + 4 : STROKE}
                    strokeDasharray={dash}
                    strokeDashoffset={offset}
                    opacity={dim ? 0.35 : 1}
                    onMouseEnter={() => setHover(s.symbol)}
                    onMouseLeave={() => setHover(null)}
                  />
                );
              })}
            </g>
            <text x={90} y={84} textAnchor="middle" fontFamily='"Archivo", monospace' fontSize={11} fill="var(--text-faint)">
              {hover ?? "TRACKED MCAP"}
            </text>
            <text x={90} y={102} textAnchor="middle" fontFamily='"Archivo", monospace' fontWeight={800} fontSize={14} fill="var(--text)">
              {hover
                ? `${(((slices.find((s) => s.symbol === hover)?.cap ?? 0) / (totalMcap || 1)) * 100).toFixed(1)}%`
                : fmtCompact(totalMcap)}
            </text>
          </svg>
        </div>

        <div className="flex flex-col gap-3">
          {/* stat tiles */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat label="TRACKED MCAP" value={fmtCompact(stats.totalMcap)} />
            <Stat label="24H VOLUME" value={fmtCompact(stats.totalVol)} />
            <Stat
              label="BTC DOMINANCE"
              value={stats.dominance !== null ? `${stats.dominance.toFixed(1)}%` : "—"}
              color={colorForSymbol("BTC")}
            />
            <Stat
              label="AVG 24H"
              value={`${stats.avgChange >= 0 ? "+" : ""}${stats.avgChange.toFixed(2)}%`}
              color={stats.avgChange >= 0 ? "var(--color-up)" : "var(--color-down)"}
            />
          </div>

          {/* breadth bar */}
          <div>
            <div className="mb-1 flex justify-between">
              <span className="label" style={{ color: "var(--color-up)" }}>▲ {stats.advancers} ADVANCING</span>
              <span className="label" style={{ color: "var(--color-down)" }}>{stats.decliners} DECLINING ▼</span>
            </div>
            <div className="flex h-3 w-full overflow-hidden" style={{ backgroundColor: "var(--bg-row)" }}>
              <div style={{ width: `${upFrac * 100}%`, backgroundColor: "var(--color-up)" }} />
              <div style={{ flex: 1, backgroundColor: "var(--color-down)" }} />
            </div>
          </div>

          {/* legend */}
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {slices.map((s) => (
              <button
                key={s.symbol}
                onMouseEnter={() => setHover(s.symbol)}
                onMouseLeave={() => setHover(null)}
                className="label flex items-center gap-1.5"
                style={{ background: "none", border: "none", cursor: "default", color: hover === s.symbol ? "var(--text)" : "var(--text-dim)" }}
              >
                <span style={{ width: 10, height: 10, backgroundColor: s.color, display: "inline-block" }} />
                {s.symbol} {totalMcap > 0 ? `${((s.cap / totalMcap) * 100).toFixed(1)}%` : ""}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
