import { useEffect, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useAllSeries } from "../hooks/UseAllSeries";
import { useCoins } from "../hooks/useCoins";
import {
  ALL_PERIODS,
  ALL_CURRENCIES,
  colorForSymbol,
  type Currency,
  type Period,
} from "../../domain/price";

const CURRENCY_SYMBOL: Record<Currency, string> = { USD: "$", EUR: "€", JPY: "¥", RUB: "₽" };

function cssVar(name: string): string {
  if (typeof window === "undefined") return "#ffb000";
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function fmtPrice(n: number, currency: Currency): string {
  return CURRENCY_SYMBOL[currency] + n.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

function fmtTime(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(iso));
}

export default function PriceCharts() {
  const { coins } = useCoins();
  const [currency, setCurrency] = useState<Currency>("USD");
  const [period, setPeriod] = useState<Period>("day");
  const [coin, setCoin] = useState<string>("");

  // Default to the top-ranked coin once the registry loads.
  useEffect(() => {
    if (!coin && coins.length > 0) setCoin(coins[0].symbol);
  }, [coins, coin]);

  const { series, loading, error } = useAllSeries(coin ? [coin] : [], currency, period);
  const points = series[0]?.points ?? [];

  const [colors, setColors] = useState({ grid: "#1c1d21", text: "#6f7177" });
  useEffect(() => {
    const resolve = () =>
      setColors({
        grid: cssVar("--grid") || "#1c1d21",
        text: cssVar("--text-dim") || "#6f7177",
      });
    resolve();
    const observer = new MutationObserver(resolve);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  const data = points.map((p) => ({ t: p.observedAt.toISOString(), v: Number(p.value) }));
  const latest = data.length > 0 ? data[data.length - 1].v : null;
  const stroke = colorForSymbol(coin || "BTC");

  const tabBtn = (active: boolean, accent = false) => ({
    backgroundColor: active ? (accent ? "var(--color-accent)" : "var(--text)") : "var(--bg-row)",
    color: active ? (accent ? "#050506" : "var(--bg)") : "var(--text-dim)",
  });

  return (
    <div className="border" style={{ borderColor: "var(--grid-strong)", backgroundColor: "var(--bg-panel)" }}>
      {/* Controls */}
      <div
        className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3"
        style={{ borderColor: "var(--grid)" }}
      >
        <div className="flex items-center gap-3">
          <select
            value={coin}
            onChange={(e) => setCoin(e.target.value)}
            className="px-3 py-1.5 text-sm font-bold"
            style={{ backgroundColor: "var(--bg-row)", color: "var(--text)", border: "1px solid var(--grid-strong)" }}
          >
            {coins.map((c) => (
              <option key={c.symbol} value={c.symbol}>
                {c.symbol} · {c.name}
              </option>
            ))}
          </select>
          <div className="flex gap-px" style={{ backgroundColor: "var(--grid)" }}>
            {ALL_PERIODS.map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className="px-4 py-1.5 text-xs font-bold uppercase tracking-wider transition-colors"
                style={tabBtn(period === p, true)}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
        <div className="flex gap-px" style={{ backgroundColor: "var(--grid)" }}>
          {ALL_CURRENCIES.map((c) => (
            <button
              key={c}
              onClick={() => setCurrency(c)}
              className="px-4 py-1.5 text-xs font-bold uppercase tracking-wider transition-colors"
              style={tabBtn(currency === c)}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* Detail chart */}
      <div className="px-5 py-4" style={{ backgroundColor: "var(--bg-panel)" }}>
        <div className="mb-3 flex items-baseline justify-between">
          <span className="text-sm font-extrabold" style={{ color: stroke }}>
            {coin || "—"}
          </span>
          {latest !== null && (
            <span className="tabular text-xl font-bold">{fmtPrice(latest, currency)}</span>
          )}
        </div>

        {loading ? (
          <span className="shimmer block h-[340px] w-full rounded" />
        ) : error ? (
          <p className="py-12 text-sm" style={{ color: "var(--color-down)" }}>CHART ERROR — {error}</p>
        ) : data.length === 0 ? (
          <p className="label py-20 text-center">NO DATA — let the backend poll a while.</p>
        ) : (
          <ResponsiveContainer width="100%" height={340}>
            <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 8 }}>
              <CartesianGrid stroke={colors.grid} strokeDasharray="2 4" vertical={false} />
              <XAxis
                dataKey="t"
                tickFormatter={fmtTime}
                tick={{ fill: colors.text, fontSize: 10, fontFamily: "Archivo" }}
                stroke={colors.grid}
                minTickGap={40}
              />
              <YAxis
                domain={["auto", "auto"]}
                tick={{ fill: colors.text, fontSize: 10, fontFamily: "Archivo" }}
                stroke={colors.grid}
                width={64}
                tickFormatter={(v) => (v >= 1000 ? (v / 1000).toFixed(1) + "k" : String(v))}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "var(--bg-row)",
                  border: `1px solid ${colors.grid}`,
                  borderRadius: 0,
                  fontFamily: "Archivo",
                  fontSize: 12,
                }}
                labelFormatter={(l) => fmtTime(String(l))}
                formatter={(v) => [fmtPrice(Number(v), currency), coin]}
              />
              <Line
                type="monotone"
                dataKey="v"
                stroke={stroke}
                strokeWidth={1.5}
                dot={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
