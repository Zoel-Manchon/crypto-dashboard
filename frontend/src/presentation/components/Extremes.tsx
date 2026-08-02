import { useMemo, useState } from "react";
import { useExtremes } from "../hooks/useExtremes";
import { useCoins } from "../hooks/useCoins";
import { useLivePrices } from "../hooks/useLivePrices";
import CoinIcon from "./CoinIcon";
import {
  ALL_PERIODS,
  ALL_CURRENCIES,
  type Currency,
  type Period,
} from "../../domain/price";

const CURRENCY_SYMBOL: Record<Currency, string> = { USD: "$", EUR: "€", JPY: "¥", RUB: "₽" };

function fmt(value: number, currency: Currency): string {
  if (Number.isNaN(value)) return "—";
  return (
    CURRENCY_SYMBOL[currency] +
    value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  );
}

export default function Extremes() {
  const [currency, setCurrency] = useState<Currency>("USD");
  const [period, setPeriod] = useState<Period>("day");
  const { symbols, bySymbol } = useCoins();
  const { extremes, loading, error } = useExtremes(symbols, currency, period);
  const { prices } = useLivePrices();

  // Map of current live price per coin (for the position marker).
  const current = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of prices) if (p.currency === currency) m.set(p.coin, Number(p.value));
    return m;
  }, [prices, currency]);

  return (
    <div className="border" style={{ borderColor: "var(--grid-strong)", backgroundColor: "var(--bg-panel)" }}>
      <div className="flex items-center justify-between border-b px-4 py-3 max-md:flex-col max-md:items-start max-md:gap-3" style={{ borderColor: "var(--grid)" }}>
        <div className="flex items-center gap-3">
          <p className="label">PRICE RANGE</p>
          <span className="label" style={{ color: "var(--text-faint)" }}>LOW · NOW · HIGH</span>
        </div>
        <div className="flex gap-3 max-md:flex-wrap">
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
      </div>

      {loading ? (
        <div className="flex flex-col gap-px px-4 py-4" style={{ backgroundColor: "var(--grid)" }}>
          {Array.from({ length: 5 }).map((_, i) => (
            <span key={i} className="shimmer block h-9 w-full rounded" style={{ backgroundColor: "var(--bg-panel)" }} />
          ))}
        </div>
      ) : error ? (
        <p className="px-4 py-6 text-sm" style={{ color: "var(--color-down)" }}>RANGE ERROR — {error}</p>
      ) : extremes.length === 0 ? (
        <p className="label px-4 py-6">NO DATA IN WINDOW — let the backend poll a while.</p>
      ) : (
        <div className="max-h-[460px] overflow-y-auto">
          {extremes.map((e) => {
            const hi = Number(e.highest);
            const lo = Number(e.lowest);
            const now = current.get(e.coin);
            const span = hi - lo;
            const pos = now !== undefined && span > 0 ? Math.min(1, Math.max(0, (now - lo) / span)) : null;
            const spreadPct = lo > 0 ? ((hi - lo) / lo) * 100 : 0;
            const meta = bySymbol[e.coin];
            return (
              <div
                key={e.coin}
                className="grid items-center gap-3 px-4 py-3"
                style={{ gridTemplateColumns: "112px 1fr 70px", borderTop: "1px solid var(--grid)" }}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <CoinIcon meta={meta} symbol={e.coin} size={18} />
                  <span className="text-sm font-bold" style={{ color: meta?.color }}>{e.coin}</span>
                </div>

                <div className="flex items-center gap-2 min-w-0">
                  <span className="tabular text-xs shrink-0" style={{ color: "var(--color-down)" }}>{fmt(lo, currency)}</span>
                  <div className="relative h-1.5 flex-1" style={{ backgroundColor: "var(--bg-row)" }}>
                    <span
                      className="absolute inset-y-0 left-0"
                      style={{
                        right: 0,
                        background: "linear-gradient(90deg, var(--color-down), var(--color-accent), var(--color-up))",
                        opacity: 0.35,
                      }}
                    />
                    {pos !== null && (
                      <span
                        className="absolute top-1/2"
                        style={{
                          left: `${pos * 100}%`,
                          width: 9,
                          height: 9,
                          marginLeft: -4.5,
                          transform: "translateY(-50%)",
                          backgroundColor: "var(--text)",
                          border: "2px solid var(--bg-panel)",
                          borderRadius: "50%",
                        }}
                        title={`now ${fmt(now!, currency)}`}
                      />
                    )}
                  </div>
                  <span className="tabular text-xs shrink-0" style={{ color: "var(--color-up)" }}>{fmt(hi, currency)}</span>
                </div>

                <span className="tabular text-right text-sm" style={{ color: "var(--text-dim)" }}>
                  {spreadPct.toFixed(1)}%
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
