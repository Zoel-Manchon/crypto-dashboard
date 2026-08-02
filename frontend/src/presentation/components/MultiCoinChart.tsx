import { useEffect, useMemo, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";
import { useAllSeries } from "../hooks/UseAllSeries";
import { useCoins } from "../hooks/useCoins";
import {
  ALL_PERIODS,
  ALL_CURRENCIES,
  colorForSymbol,
  type Coin,
  type Currency,
  type Period,
} from "../../domain/price";

const DEFAULT_PICK = 6; // coins pre-selected for the overlay

function fmtTime(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(iso));
}

function cssVar(name: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

export default function MultiCoinChart() {
  const { coins } = useCoins();
  const [currency, setCurrency] = useState<Currency>("USD");
  const [period, setPeriod] = useState<Period>("day");
  const [selected, setSelected] = useState<Coin[]>([]);

  // Pre-select the top few coins once the registry is known.
  useEffect(() => {
    if (selected.length === 0 && coins.length > 0) {
      setSelected(coins.slice(0, DEFAULT_PICK).map((c) => c.symbol));
    }
  }, [coins, selected.length]);

  const { series, loading, error } = useAllSeries(selected, currency, period);

  const [colors, setColors] = useState({ grid: "#1c1d21", text: "#6f7177" });
  useEffect(() => {
    const resolve = () =>
      setColors({ grid: cssVar("--grid", "#1c1d21"), text: cssVar("--text-dim", "#6f7177") });
    resolve();
    const obs = new MutationObserver(resolve);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);

  // Build a time-aligned dataset of % change from each coin's first point.
  const { data, latestPct, coinsWithData } = useMemo(() => {
    const rowMap = new Map<string, Record<string, number | string>>();
    const latest: Record<string, number> = {};
    for (const s of series) {
      if (s.points.length === 0) continue;
      const base = Number(s.points[0].value);
      if (!(base > 0)) continue;
      for (const p of s.points) {
        const t = p.observedAt.toISOString();
        const pct = ((Number(p.value) - base) / base) * 100;
        const row = rowMap.get(t) ?? { t };
        row[s.coin] = pct;
        rowMap.set(t, row);
        latest[s.coin] = pct;
      }
    }
    const rows = Array.from(rowMap.values()).sort((a, b) =>
      String(a.t).localeCompare(String(b.t)),
    );
    const withData = series.filter((s) => s.points.length > 0).map((s) => s.coin);
    return { data: rows, latestPct: latest, coinsWithData: withData };
  }, [series]);

  function toggle(symbol: Coin) {
    setSelected((prev) =>
      prev.includes(symbol) ? prev.filter((s) => s !== symbol) : [...prev, symbol],
    );
  }

  return (
    <div className="border" style={{ borderColor: "var(--grid-strong)", backgroundColor: "var(--bg-panel)" }}>
      {/* Controls */}
      <div
        className="flex items-center justify-between border-b px-4 py-3 max-md:flex-col max-md:items-start max-md:gap-3"
        style={{ borderColor: "var(--grid)" }}
      >
        <div className="flex gap-px" style={{ backgroundColor: "var(--grid)" }}>
          {ALL_PERIODS.map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className="px-4 py-1.5 text-xs font-bold uppercase tracking-wider transition-colors"
              style={{
                backgroundColor: period === p ? "var(--color-accent)" : "var(--bg-row)",
                color: period === p ? "#050506" : "var(--text-dim)",
              }}
            >
              {p}
            </button>
          ))}
        </div>
        <div className="flex gap-px" style={{ backgroundColor: "var(--grid)" }}>
          {ALL_CURRENCIES.map((c) => (
            <button
              key={c}
              onClick={() => setCurrency(c)}
              className="px-4 py-1.5 text-xs font-bold uppercase tracking-wider transition-colors"
              style={{
                backgroundColor: currency === c ? "var(--text)" : "var(--bg-row)",
                color: currency === c ? "var(--bg)" : "var(--text-dim)",
              }}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* Coin selector */}
      <div className="flex flex-wrap gap-2 border-b px-4 py-3" style={{ borderColor: "var(--grid)" }}>
        {coins.map((c) => {
          const on = selected.includes(c.symbol);
          return (
            <button
              key={c.symbol}
              onClick={() => toggle(c.symbol)}
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold uppercase transition-opacity"
              style={{
                backgroundColor: "var(--bg-row)",
                border: `1px solid ${on ? c.color : "var(--grid)"}`,
                color: on ? "var(--text)" : "var(--text-faint)",
                opacity: on ? 1 : 0.6,
              }}
            >
              <span className="inline-block h-2 w-2" style={{ backgroundColor: on ? c.color : "var(--text-faint)" }} />
              {c.symbol}
            </button>
          );
        })}
      </div>

      {/* Legend */}
      {coinsWithData.length > 0 && (
        <div className="flex flex-wrap gap-4 border-b px-4 py-2" style={{ borderColor: "var(--grid)" }}>
          {coinsWithData.map((coin) => {
            const pct = latestPct[coin] ?? 0;
            return (
              <div key={coin} className="flex items-center gap-2">
                <span className="inline-block h-2 w-3" style={{ backgroundColor: colorForSymbol(coin) }} />
                <span className="text-xs font-bold">{coin}</span>
                <span
                  className="tabular text-xs font-bold"
                  style={{ color: pct >= 0 ? "var(--color-up)" : "var(--color-down)" }}
                >
                  {pct >= 0 ? "+" : ""}{pct.toFixed(2)}%
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Chart */}
      {loading ? (
        <div className="px-4 py-4">
          <span className="shimmer block h-[340px] w-full rounded" />
        </div>
      ) : error ? (
        <p className="px-4 py-12 text-sm" style={{ color: "var(--color-down)" }}>OVERLAY ERROR — {error}</p>
      ) : selected.length === 0 ? (
        <p className="label px-4 py-12">SELECT COINS TO COMPARE</p>
      ) : data.length === 0 ? (
        <p className="label px-4 py-12">NO DATA IN WINDOW</p>
      ) : (
        <div className="px-4 py-4">
          <ResponsiveContainer width="100%" height={340}>
            <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 4 }}>
              <CartesianGrid stroke={colors.grid} strokeDasharray="2 4" vertical={false} />
              <XAxis
                dataKey="t"
                tickFormatter={fmtTime}
                tick={{ fill: colors.text, fontSize: 10, fontFamily: "Archivo" }}
                stroke={colors.grid}
                minTickGap={50}
              />
              <YAxis
                tick={{ fill: colors.text, fontSize: 10, fontFamily: "Archivo" }}
                stroke={colors.grid}
                width={50}
                tickFormatter={(v) => `${v > 0 ? "+" : ""}${v.toFixed(1)}%`}
              />
              <ReferenceLine y={0} stroke={colors.text} strokeDasharray="3 3" />
              <Tooltip
                contentStyle={{
                  backgroundColor: "var(--bg-row)",
                  border: `1px solid ${colors.grid}`,
                  borderRadius: 0,
                  fontFamily: "Archivo",
                  fontSize: 12,
                }}
                labelFormatter={(l) => fmtTime(String(l))}
                formatter={(v, name) => {
                  const n = Number(v);
                  return [`${n >= 0 ? "+" : ""}${n.toFixed(2)}%`, name];
                }}
              />
              {coinsWithData.map((coin) => (
                <Line
                  key={coin}
                  type="monotone"
                  dataKey={coin}
                  stroke={colorForSymbol(coin)}
                  strokeWidth={1.5}
                  dot={false}
                  isAnimationActive={false}
                  connectNulls
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
