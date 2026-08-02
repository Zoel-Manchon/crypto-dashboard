import { useEffect, useMemo, useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { api } from "../../infrastructure/container";
import { useCoins } from "../hooks/useCoins";
import { useLivePrices } from "../hooks/useLivePrices";
import CoinIcon from "./CoinIcon";
import Sparkline from "./Sparkline";
import {
  ALL_PERIODS, ALL_CURRENCIES, colorForSymbol,
  type Currency, type Period, type PricePoint,
} from "../../domain/price";

const CURRENCY_SYMBOL: Record<Currency, string> = { USD: "$", EUR: "€", JPY: "¥", RUB: "₽" };

const fmt = (n: number, c: Currency) =>
  CURRENCY_SYMBOL[c] + n.toLocaleString("en-US", { maximumFractionDigits: 2 });

function fmtCompact(n: number | null): string {
  if (n === null || Number.isNaN(n)) return "—";
  const a = Math.abs(n);
  if (a >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (a >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (a >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (a >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}
function fmtSupply(n: number | null): string {
  if (n === null || Number.isNaN(n)) return "—";
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  return n.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="border px-3 py-2" style={{ borderColor: "var(--grid)", backgroundColor: "var(--bg-row)" }}>
      <div className="label" style={{ color: "var(--text-faint)" }}>{label}</div>
      <div className="tabular text-sm font-bold" style={{ color: color ?? "var(--text)" }}>{value}</div>
    </div>
  );
}

export default function CoinDetail() {
  const { bySymbol, loading: coinsLoading } = useCoins();
  const { prices } = useLivePrices();

  const symbol = useMemo(() => {
    if (typeof window === "undefined") return "";
    return (new URLSearchParams(window.location.search).get("symbol") ?? "").toUpperCase();
  }, []);

  const [currency, setCurrency] = useState<Currency>("USD");
  const [period, setPeriod] = useState<Period>("day");
  const [series, setSeries] = useState<PricePoint[]>([]);
  const [loading, setLoading] = useState(true);

  const meta = bySymbol[symbol];

  useEffect(() => {
    if (!symbol) return;
    let cancelled = false;
    setLoading(true);
    api.series(symbol, currency, period)
      .then((s) => { if (!cancelled) { setSeries(s); setLoading(false); } })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [symbol, currency, period]);

  const current = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of prices) if (p.coin === symbol) m.set(p.currency, Number(p.value));
    return m;
  }, [prices, symbol]);

  const price = current.get(currency) ?? null;
  const stroke = colorForSymbol(symbol || "BTC");
  const data = series.map((p) => ({ t: p.observedAt.getTime(), v: Number(p.value) }));

  if (!symbol) {
    return <p className="label">NO COIN SELECTED — open from a card on the dashboard.</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <a href="/" className="label" style={{ color: "var(--text-dim)" }}>← BACK TO TERMINAL</a>

      <header className="flex items-center gap-3">
        <CoinIcon meta={meta} symbol={symbol} size={36} />
        <div>
          <div className="text-2xl font-extrabold" style={{ color: stroke }}>{symbol}</div>
          <div className="label">{meta?.name ?? symbol}{meta?.rank ? ` · RANK #${meta.rank}` : ""}</div>
        </div>
        <div className="ml-auto text-right">
          <div className="tabular text-2xl font-bold">{price !== null ? fmt(price, currency) : (coinsLoading ? "…" : "—")}</div>
          {meta?.change24h != null && (
            <div className="text-sm font-bold" style={{ color: meta.change24h >= 0 ? "var(--color-up)" : "var(--color-down)" }}>
              {meta.change24h >= 0 ? "▲ +" : "▼ "}{meta.change24h.toFixed(2)}% (24h)
            </div>
          )}
        </div>
      </header>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="MARKET CAP" value={fmtCompact(meta?.marketCap ?? null)} />
        <Stat label="24H VOLUME" value={fmtCompact(meta?.volume24h ?? null)} />
        <Stat label="CIRC. SUPPLY" value={fmtSupply(meta?.circulatingSupply ?? null)} />
        <Stat
          label="24H CHANGE"
          value={meta?.change24h != null ? `${meta.change24h >= 0 ? "+" : ""}${meta.change24h.toFixed(2)}%` : "—"}
          color={meta?.change24h != null ? (meta.change24h >= 0 ? "var(--color-up)" : "var(--color-down)") : undefined}
        />
      </div>

      {meta?.sparkline7d && meta.sparkline7d.length > 1 && (
        <div className="border px-3 py-3" style={{ borderColor: "var(--grid-strong)", backgroundColor: "var(--bg-panel)" }}>
          <div className="label mb-2" style={{ color: "var(--text-faint)" }}>7-DAY TREND (USD)</div>
          <Sparkline data={meta.sparkline7d} width={680} height={64} />
        </div>
      )}

      <div className="border" style={{ borderColor: "var(--grid-strong)", backgroundColor: "var(--bg-panel)" }}>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3" style={{ borderColor: "var(--grid)" }}>
          <div className="flex gap-px" style={{ backgroundColor: "var(--grid)" }}>
            {ALL_PERIODS.map((p) => (
              <button key={p} onClick={() => setPeriod(p)} className="px-4 py-1.5 text-xs font-bold uppercase tracking-wider"
                style={{ backgroundColor: period === p ? "var(--color-accent)" : "var(--bg-row)", color: period === p ? "#050506" : "var(--text-dim)" }}>{p}</button>
            ))}
          </div>
          <div className="flex gap-px" style={{ backgroundColor: "var(--grid)" }}>
            {ALL_CURRENCIES.map((c) => (
              <button key={c} onClick={() => setCurrency(c)} className="px-4 py-1.5 text-xs font-bold uppercase tracking-wider"
                style={{ backgroundColor: currency === c ? "var(--text)" : "var(--bg-row)", color: currency === c ? "var(--bg)" : "var(--text-dim)" }}>{c}</button>
            ))}
          </div>
        </div>
        <div className="px-4 py-4">
          {loading ? (
            <span className="shimmer block h-[300px] w-full rounded" />
          ) : data.length === 0 ? (
            <p className="label py-20 text-center">NO DATA YET — let the backend poll a while.</p>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={data} margin={{ top: 6, right: 8, bottom: 0, left: 8 }}>
                <CartesianGrid stroke="var(--grid)" strokeDasharray="2 4" vertical={false} />
                <XAxis dataKey="t" tick={{ fill: "var(--text-dim)", fontSize: 10, fontFamily: "Archivo" }} stroke="var(--grid)"
                  tickFormatter={(t) => new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(Number(t)))} minTickGap={50} />
                <YAxis tick={{ fill: "var(--text-dim)", fontSize: 10, fontFamily: "Archivo" }} stroke="var(--grid)" width={64}
                  domain={["auto", "auto"]} tickFormatter={(v) => (v >= 1000 ? (v / 1000).toFixed(1) + "k" : String(v))} />
                <Tooltip contentStyle={{ backgroundColor: "var(--bg-row)", border: "1px solid var(--grid)", borderRadius: 0, fontFamily: "Archivo", fontSize: 12 }}
                  labelFormatter={(l) => new Date(Number(l)).toLocaleString()} formatter={(v) => [fmt(Number(v), currency), symbol]} />
                <Line type="monotone" dataKey="v" stroke={stroke} strokeWidth={1.5} dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}
