import { useEffect, useRef, useState } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { priceStream, backendPriceStream, binancePriceStream } from "../../infrastructure/container";
import { useCoins } from "../hooks/useCoins";
import { ALL_CURRENCIES, colorForSymbol, type Currency } from "../../domain/price";

const CURRENCY_SYMBOL: Record<Currency, string> = { USD: "$", EUR: "€", JPY: "¥", RUB: "₽" };
const MAX_TICKS = 600; // rolling in-memory window — ~10s of frames, or hours of polls

/* Three views of the same port. "Live" is the composite the rest of the
 * terminal runs on; the other two are there so you can see, side by side, what
 * each adapter actually delivers — the backend once a poll cycle, Binance on
 * every trade. */
const SOURCES = [
  { key: "live", label: "⚡ LIVE", hint: "Composite — exchange trades plus backend polls" },
  { key: "backend", label: "▲ BACKEND", hint: "Backend WebSocket — one batch per poll cycle" },
  { key: "binance", label: "◈ BINANCE", hint: "Binance trade stream — sub-second, USDT≈USD" },
] as const;

type Source = (typeof SOURCES)[number]["key"];

interface Tick { t: number; v: number; }

function fmtTime(ms: number): string {
  return new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).format(new Date(ms));
}
function cssVar(name: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

export default function RealtimeChart() {
  const { coins } = useCoins();
  const [coin, setCoin] = useState("");
  const [currency, setCurrency] = useState<Currency>("USD");
  const [source, setSource] = useState<Source>("live");
  const [ticks, setTicks] = useState<Tick[]>([]);
  const [last, setLast] = useState<number | null>(null);
  const [dir, setDir] = useState<"up" | "down" | null>(null);
  const prevRef = useRef<number | null>(null);

  useEffect(() => {
    if (!coin && coins.length > 0) setCoin(coins[0].symbol);
  }, [coins, coin]);

  // Reset the buffer whenever the watched coin/currency/source changes.
  useEffect(() => {
    setTicks([]);
    setLast(null);
    prevRef.current = null;
  }, [coin, currency, source]);

  // Binance pairs are USDT-quoted; pin the display currency to USD there.
  useEffect(() => {
    if (source === "binance" && currency !== "USD") setCurrency("USD");
  }, [source, currency]);

  // Ticks per second, measured over the last two seconds — the honest answer to
  // "is this actually realtime?", rather than a label that just claims it is.
  const rate = (() => {
    if (ticks.length < 2) return 0;
    const now = ticks[ticks.length - 1].t;
    const recent = ticks.filter((k) => now - k.t <= 2000).length;
    return recent / 2;
  })();

  // Subscribe to the live stream and append matching ticks — purely in memory.
  useEffect(() => {
    if (!coin) return;
    const stream =
      source === "binance" ? binancePriceStream : source === "backend" ? backendPriceStream : priceStream;
    const unsubscribe = stream.subscribe((prices) => {
      const hit = prices.find((p) => p.coin === coin && p.currency === currency);
      if (!hit) return;
      const v = Number(hit.value);
      const t = hit.observedAt.getTime();
      setTicks((prev) => {
        // Two trades can share a millisecond. Replacing rather than dropping
        // keeps the latest print — dropping made the line visibly lag the
        // headline price on busy pairs.
        if (prev.length > 0 && prev[prev.length - 1].t === t) {
          const next = prev.slice(0, -1);
          next.push({ t, v });
          return next;
        }
        return [...prev, { t, v }].slice(-MAX_TICKS);
      });
      if (prevRef.current !== null) setDir(v >= prevRef.current ? "up" : "down");
      prevRef.current = v;
      setLast(v);
    });
    return unsubscribe;
  }, [coin, currency, source]);

  const [colors, setColors] = useState({ grid: "#1c1d21", text: "#6f7177" });
  useEffect(() => {
    const resolve = () => setColors({ grid: cssVar("--grid", "#1c1d21"), text: cssVar("--text-dim", "#6f7177") });
    resolve();
    const obs = new MutationObserver(resolve);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);

  const stroke = colorForSymbol(coin || "BTC");
  const lastColor = dir === "up" ? "var(--color-up)" : dir === "down" ? "var(--color-down)" : "var(--text)";

  return (
    <div className="border" style={{ borderColor: "var(--grid-strong)", backgroundColor: "var(--bg-panel)" }}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3" style={{ borderColor: "var(--grid)" }}>
        <div className="flex items-center gap-3">
          <span className="label" style={{ color: "var(--color-up)" }}>● REALTIME TICKER</span>
          <select
            value={coin}
            onChange={(e) => setCoin(e.target.value)}
            className="px-3 py-1.5 text-sm font-bold"
            style={{ backgroundColor: "var(--bg-row)", color: "var(--text)", border: "1px solid var(--grid-strong)" }}
          >
            {coins.map((c) => (
              <option key={c.symbol} value={c.symbol}>{c.symbol} · {c.name}</option>
            ))}
          </select>
          <div className="flex gap-px" style={{ backgroundColor: "var(--grid)" }}>
            {SOURCES.map((s) => (
              <button
                key={s.key}
                onClick={() => setSource(s.key)}
                className="px-3 py-1.5 text-xs font-bold uppercase tracking-wider"
                title={s.hint}
                style={{
                  backgroundColor: source === s.key ? "var(--color-accent)" : "var(--bg-row)",
                  color: source === s.key ? "var(--cw-on-accent)" : "var(--text-dim)",
                }}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex gap-px" style={{ backgroundColor: "var(--grid)" }}>
          {ALL_CURRENCIES.map((c) => (
            <button
              key={c}
              onClick={() => setCurrency(c)}
              disabled={source === "binance" && c !== "USD"}
              className="px-4 py-1.5 text-xs font-bold uppercase tracking-wider transition-colors"
              style={{ backgroundColor: currency === c ? "var(--text)" : "var(--bg-row)", color: currency === c ? "var(--bg)" : "var(--text-dim)", opacity: source === "binance" && c !== "USD" ? 0.35 : 1 }}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      <div className="px-5 py-4">
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <span className="flex items-baseline gap-3">
            <span className="text-sm font-extrabold" style={{ color: stroke }}>{coin || "—"}</span>
            <span className="label">{rate.toFixed(1)} ticks/s · {ticks.length} in buffer</span>
          </span>
          <span className="tabular text-2xl font-bold" style={{ color: lastColor }}>
            {last !== null ? CURRENCY_SYMBOL[currency] + last.toLocaleString("en-US", { maximumFractionDigits: 2 }) : "—"}
            {dir && <span className="ml-2 text-sm">{dir === "up" ? "▲" : "▼"}</span>}
          </span>
        </div>

        {ticks.length === 0 ? (
          <div className="flex h-[240px] flex-col items-center justify-center gap-2" style={{ color: "var(--text-faint)" }}>
            <span className="label">WAITING FOR LIVE TICKS…</span>
            <span className="text-xs">
              {source === "backend"
                ? "streams in as the backend polls (every POLL_INTERVAL_SECONDS)"
                : "connecting to the exchange trade stream — first tick usually lands in under a second"}
            </span>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={ticks} margin={{ top: 6, right: 8, bottom: 0, left: 8 }}>
              <CartesianGrid stroke={colors.grid} strokeDasharray="2 4" vertical={false} />
              <XAxis dataKey="t" tickFormatter={fmtTime} tick={{ fill: colors.text, fontSize: 10, fontFamily: "Archivo" }} stroke={colors.grid} minTickGap={50} />
              <YAxis domain={["auto", "auto"]} tick={{ fill: colors.text, fontSize: 10, fontFamily: "Archivo" }} stroke={colors.grid} width={64} tickFormatter={(v) => (v >= 1000 ? (v / 1000).toFixed(1) + "k" : String(v))} />
              <Tooltip
                contentStyle={{ backgroundColor: "var(--bg-row)", border: `1px solid ${colors.grid}`, borderRadius: 0, fontFamily: "Archivo", fontSize: 12 }}
                labelFormatter={(l) => fmtTime(Number(l))}
                formatter={(v) => [CURRENCY_SYMBOL[currency] + Number(v).toLocaleString("en-US", { maximumFractionDigits: 2 }), coin]}
              />
              <Line type="monotone" dataKey="v" stroke={stroke} strokeWidth={1.6} dot={ticks.length <= 60 ? { r: 2, fill: stroke } : false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
