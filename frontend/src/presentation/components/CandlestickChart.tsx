import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../../infrastructure/container";
import { useCoins } from "../hooks/useCoins";
import { ALL_PERIODS, ALL_CURRENCIES, type Candle, type Currency, type Period } from "../../domain/price";
import { ema, rsi, bollinger } from "../../domain/indicators";

const CURRENCY_SYMBOL: Record<Currency, string> = { USD: "$", EUR: "€", JPY: "¥", RUB: "₽" };
const H = 300;
const PAD_L = 60;
const PAD_R = 12;
const PAD_T = 10;
const PAD_B = 22;
const RSI_H = 84;
const IND_COLORS = { ema12: "#f0b90b", ema26: "#4f9cf9", bb: "#a78bfa", rsi: "#22d3ee" } as const;
type IndKey = keyof typeof IND_COLORS;

function fmtPrice(n: number, c: Currency): string {
  return CURRENCY_SYMBOL[c] + n.toLocaleString("en-US", { maximumFractionDigits: 2 });
}
function fmtTime(d: Date, period: Period): string {
  return period === "day"
    ? new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false }).format(d)
    : new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short" }).format(d);
}

export default function CandlestickChart() {
  const { coins } = useCoins();
  const [coin, setCoin] = useState("");
  const [currency, setCurrency] = useState<Currency>("USD");
  const [period, setPeriod] = useState<Period>("day");
  const [candles, setCandles] = useState<Candle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const [ind, setInd] = useState<Record<IndKey, boolean>>({ ema12: false, ema26: false, bb: false, rsi: false });

  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(720);

  useEffect(() => {
    if (!coin && coins.length > 0) setCoin(coins[0].symbol);
  }, [coins, coin]);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const obs = new ResizeObserver((entries) => setWidth(Math.max(320, entries[0].contentRect.width)));
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (!coin) return;
    let cancelled = false;
    setLoading(true);
    api
      .ohlc(coin, currency, period)
      .then((c) => { if (!cancelled) { setCandles(c); setError(null); setLoading(false); } })
      .catch((e) => { if (!cancelled) { setError(String(e)); setLoading(false); } });
    return () => { cancelled = true; };
  }, [coin, currency, period]);

  const closes = useMemo(() => candles.map((c) => c.c), [candles]);
  const series = useMemo(
    () => ({
      ema12: ind.ema12 ? ema(closes, 12) : null,
      ema26: ind.ema26 ? ema(closes, 26) : null,
      bb: ind.bb ? bollinger(closes, 20, 2) : null,
      rsi: ind.rsi ? rsi(closes, 14) : null,
    }),
    [closes, ind],
  );

  const { lo, hi } = useMemo(() => {
    if (candles.length === 0) return { lo: 0, hi: 1 };
    let l = Infinity, h = -Infinity;
    for (const c of candles) { l = Math.min(l, c.l); h = Math.max(h, c.h); }
    // Overlays (esp. Bollinger) can exceed the candle range — include them.
    const fold = (arr: (number | null)[] | null | undefined) => {
      for (const v of arr ?? []) if (v !== null) { l = Math.min(l, v); h = Math.max(h, v); }
    };
    fold(series.ema12); fold(series.ema26); fold(series.bb?.upper); fold(series.bb?.lower);
    const padv = (h - l) * 0.06 || h * 0.01 || 1;
    return { lo: l - padv, hi: h + padv };
  }, [candles, series]);

  const plotW = width - PAD_L - PAD_R;
  const plotH = H - PAD_T - PAD_B;
  const yOf = (v: number) => PAD_T + (1 - (v - lo) / (hi - lo || 1)) * plotH;
  const step = candles.length > 0 ? plotW / candles.length : plotW;
  const bodyW = Math.max(1.5, Math.min(14, step * 0.6));

  const yTicks = useMemo(() => {
    const n = 4;
    return Array.from({ length: n + 1 }, (_, i) => lo + ((hi - lo) * i) / n);
  }, [lo, hi]);

  const tabBtn = (active: boolean, accent = false) => ({
    backgroundColor: active ? (accent ? "var(--color-accent)" : "var(--text)") : "var(--bg-row)",
    color: active ? (accent ? "#050506" : "var(--bg)") : "var(--text-dim)",
  });

  const svgH = H + (ind.rsi ? RSI_H : 0);
  const xOf = (i: number) => PAD_L + i * step + step / 2;
  const linePoints = (arr: (number | null)[]) =>
    arr.map((v, i) => (v === null ? null : `${xOf(i)},${yOf(v)}`)).filter(Boolean).join(" ");
  const rsiY = (v: number) => H + 10 + (1 - v / 100) * (RSI_H - 26);

  const shown = hover !== null ? candles[hover] : candles[candles.length - 1];
  const up = shown ? shown.c >= shown.o : true;

  return (
    <div className="border" style={{ borderColor: "var(--grid-strong)", backgroundColor: "var(--bg-panel)" }}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3" style={{ borderColor: "var(--grid)" }}>
        <div className="flex items-center gap-3">
          <span className="label">CANDLES</span>
          <select value={coin} onChange={(e) => setCoin(e.target.value)} className="px-3 py-1.5 text-sm font-bold"
            style={{ backgroundColor: "var(--bg-row)", color: "var(--text)", border: "1px solid var(--grid-strong)" }}>
            {coins.map((c) => <option key={c.symbol} value={c.symbol}>{c.symbol} · {c.name}</option>)}
          </select>
          <div className="flex gap-px" style={{ backgroundColor: "var(--grid)" }}>
            {ALL_PERIODS.map((p) => (
              <button key={p} onClick={() => setPeriod(p)} className="px-4 py-1.5 text-xs font-bold uppercase tracking-wider" style={tabBtn(period === p, true)}>{p}</button>
            ))}
          </div>
          <div className="flex gap-px" style={{ backgroundColor: "var(--grid)" }}>
            {(Object.keys(IND_COLORS) as IndKey[]).map((k) => (
              <button
                key={k}
                onClick={() => setInd((s) => ({ ...s, [k]: !s[k] }))}
                className="px-3 py-1.5 text-xs font-bold uppercase tracking-wider"
                title={{ ema12: "EMA 12", ema26: "EMA 26", bb: "Bollinger 20·2", rsi: "RSI 14" }[k]}
                style={{
                  backgroundColor: ind[k] ? "var(--bg-row)" : "var(--bg-row)",
                  color: ind[k] ? IND_COLORS[k] : "var(--text-faint)",
                  boxShadow: ind[k] ? `inset 0 -2px 0 ${IND_COLORS[k]}` : "none",
                }}
              >
                {{ ema12: "EMA12", ema26: "EMA26", bb: "BB", rsi: "RSI" }[k]}
              </button>
            ))}
          </div>
        </div>
        <div className="flex gap-px" style={{ backgroundColor: "var(--grid)" }}>
          {ALL_CURRENCIES.map((c) => (
            <button key={c} onClick={() => setCurrency(c)} className="px-4 py-1.5 text-xs font-bold uppercase tracking-wider" style={tabBtn(currency === c)}>{c}</button>
          ))}
        </div>
      </div>

      {/* OHLC readout */}
      {shown && (
        <div className="flex flex-wrap gap-4 border-b px-4 py-2 text-xs" style={{ borderColor: "var(--grid)" }}>
          <span style={{ color: "var(--text-faint)" }}>{fmtTime(shown.t, period)}</span>
          {([["O", shown.o], ["H", shown.h], ["L", shown.l], ["C", shown.c]] as [string, number][]).map(([k, v]) => (
            <span key={k} className="tabular"><span style={{ color: "var(--text-faint)" }}>{k}</span> <span style={{ color: up ? "var(--color-up)" : "var(--color-down)" }}>{fmtPrice(v, currency)}</span></span>
          ))}
        </div>
      )}

      <div ref={wrapRef} className="px-2 py-3">
        {loading ? (
          <span className="shimmer block w-full rounded" style={{ height: H }} />
        ) : error ? (
          <p className="px-2 py-12 text-sm" style={{ color: "var(--color-down)" }}>CANDLE ERROR — {error}</p>
        ) : candles.length === 0 ? (
          <p className="label px-2 py-20 text-center">NO CANDLES YET — needs a few polling cycles of history.</p>
        ) : (
          <svg width={width} height={svgH} style={{ display: "block" }} onMouseLeave={() => setHover(null)}>
            {/* y grid + labels */}
            {yTicks.map((v, i) => (
              <g key={i}>
                <line x1={PAD_L} y1={yOf(v)} x2={width - PAD_R} y2={yOf(v)} stroke="var(--grid)" strokeDasharray="2 4" />
                <text x={PAD_L - 6} y={yOf(v) + 3} textAnchor="end" fontSize={10} fontFamily="Archivo" fill="var(--text-dim)">
                  {v >= 1000 ? (v / 1000).toFixed(1) + "k" : v.toFixed(2)}
                </text>
              </g>
            ))}
            {/* candles */}
            {candles.map((c, i) => {
              const cx = PAD_L + i * step + step / 2;
              const green = c.c >= c.o;
              const col = green ? "var(--color-up)" : "var(--color-down)";
              const yO = yOf(c.o), yC = yOf(c.c);
              const top = Math.min(yO, yC);
              const bh = Math.max(1, Math.abs(yC - yO));
              return (
                <g key={i} onMouseEnter={() => setHover(i)}>
                  <rect x={PAD_L + i * step} y={PAD_T} width={step} height={plotH} fill={hover === i ? "var(--bg-row)" : "transparent"} opacity={0.5} />
                  <line x1={cx} y1={yOf(c.h)} x2={cx} y2={yOf(c.l)} stroke={col} strokeWidth={1} vectorEffect="non-scaling-stroke" />
                  <rect x={cx - bodyW / 2} y={top} width={bodyW} height={bh} fill={col} />
                </g>
              );
            })}
            {/* indicator overlays */}
            {series.bb && (
              <g>
                <polyline points={linePoints(series.bb.upper)} fill="none" stroke={IND_COLORS.bb} strokeWidth={1} strokeDasharray="3 3" opacity={0.9} />
                <polyline points={linePoints(series.bb.lower)} fill="none" stroke={IND_COLORS.bb} strokeWidth={1} strokeDasharray="3 3" opacity={0.9} />
                <polyline points={linePoints(series.bb.mid)} fill="none" stroke={IND_COLORS.bb} strokeWidth={1} opacity={0.55} />
              </g>
            )}
            {series.ema12 && <polyline points={linePoints(series.ema12)} fill="none" stroke={IND_COLORS.ema12} strokeWidth={1.5} />}
            {series.ema26 && <polyline points={linePoints(series.ema26)} fill="none" stroke={IND_COLORS.ema26} strokeWidth={1.5} />}
            {/* RSI subpanel */}
            {series.rsi && (
              <g>
                <line x1={PAD_L} y1={H + 4} x2={width - PAD_R} y2={H + 4} stroke="var(--grid-strong)" />
                {[70, 30].map((g) => (
                  <g key={g}>
                    <line x1={PAD_L} y1={rsiY(g)} x2={width - PAD_R} y2={rsiY(g)} stroke="var(--grid)" strokeDasharray="2 4" />
                    <text x={PAD_L - 6} y={rsiY(g) + 3} textAnchor="end" fontSize={9} fontFamily="Archivo" fill="var(--text-faint)">{g}</text>
                  </g>
                ))}
                <polyline points={series.rsi.map((v, i) => (v === null ? null : `${xOf(i)},${rsiY(v)}`)).filter(Boolean).join(" ")} fill="none" stroke={IND_COLORS.rsi} strokeWidth={1.5} />
                <text x={PAD_L + 2} y={H + 14} fontSize={9} fontFamily="Archivo" fill={IND_COLORS.rsi}>RSI 14</text>
              </g>
            )}
            {/* x labels (sparse) */}
            {candles.map((c, i) => {
              const everyN = Math.ceil(candles.length / 6);
              if (i % everyN !== 0) return null;
              const cx = PAD_L + i * step + step / 2;
              return <text key={`x${i}`} x={cx} y={H - 6} textAnchor="middle" fontSize={10} fontFamily="Archivo" fill="var(--text-dim)">{fmtTime(c.t, period)}</text>;
            })}
          </svg>
        )}
      </div>
    </div>
  );
}
