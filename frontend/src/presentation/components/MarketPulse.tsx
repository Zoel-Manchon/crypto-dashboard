import { useMemo, useState } from "react";
import { useLivePrices } from "../hooks/useLivePrices";
import { useCoins } from "../hooks/useCoins";
import CoinIcon from "./CoinIcon";
import { ALL_CURRENCIES, type Currency, type Price } from "../../domain/price";

const CURRENCY_SYMBOL: Record<Currency, string> = { USD: "$", EUR: "€", JPY: "¥", RUB: "₽" };

function fmt(value: string, currency: Currency): string {
  const n = Number(value);
  if (Number.isNaN(n)) return value;
  return CURRENCY_SYMBOL[currency] + n.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

export default function MarketPulse() {
  const [currency, setCurrency] = useState<Currency>("USD");
  const { prices, loading, error, live } = useLivePrices();
  const { bySymbol } = useCoins();

  const rows = useMemo(() => {
    return prices
      .filter((p): p is Price => p.currency === currency)
      .map((p) => ({ ...p, change: p.change24h ?? null }))
      .sort((a, b) => (b.change ?? -Infinity) - (a.change ?? -Infinity));
  }, [prices, currency]);

  // Scale the diverging bars to the largest absolute move on screen.
  const maxAbs = useMemo(
    () => Math.max(1, ...rows.map((r) => Math.abs(r.change ?? 0))),
    [rows],
  );

  const gainers = rows.filter((r) => (r.change ?? 0) > 0).length;
  const losers = rows.filter((r) => (r.change ?? 0) < 0).length;

  return (
    <div className="border" style={{ borderColor: "var(--grid-strong)", backgroundColor: "var(--bg-panel)" }}>
      <div className="flex items-center justify-between border-b px-4 py-3 max-md:flex-col max-md:items-start max-md:gap-3" style={{ borderColor: "var(--grid)" }}>
        <div className="flex items-center gap-3">
          <p className="label">MARKET PULSE</p>
          {!loading && !error && (
            <span className="flex items-center gap-2 text-xs font-bold">
              <span style={{ color: "var(--color-up)" }}>▲ {gainers}</span>
              <span style={{ color: "var(--color-down)" }}>▼ {losers}</span>
              <span className="label" style={{ color: live ? "var(--color-up)" : "var(--text-faint)" }}>
                {live ? "● LIVE" : "○ SNAPSHOT"}
              </span>
            </span>
          )}
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

      {loading ? (
        <div className="flex flex-col gap-px px-4 py-4" style={{ backgroundColor: "var(--grid)" }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <span key={i} className="shimmer block h-7 w-full rounded" style={{ backgroundColor: "var(--bg-panel)" }} />
          ))}
        </div>
      ) : error ? (
        <p className="px-4 py-6 text-sm" style={{ color: "var(--color-down)" }}>PULSE ERROR — {error}</p>
      ) : rows.length === 0 ? (
        <p className="label px-4 py-6">NO {currency} DATA YET</p>
      ) : (
        <div className="max-h-[460px] overflow-y-auto">
          {rows.map((p) => {
            const change = p.change ?? 0;
            const up = change >= 0;
            const barColor = up ? "var(--color-up)" : "var(--color-down)";
            const widthPct = (Math.abs(change) / maxAbs) * 50; // half-track each side
            const meta = bySymbol[p.coin];
            return (
              <div
                key={p.coin}
                className="grid items-center gap-3 px-4 py-2"
                style={{
                  gridTemplateColumns: "118px 1fr 78px 96px",
                  borderTop: "1px solid var(--grid)",
                }}
              >
                {/* coin */}
                <div className="flex items-center gap-2 min-w-0">
                  <CoinIcon meta={meta} symbol={p.coin} size={18} />
                  <span className="text-sm font-bold" style={{ color: meta?.color }}>{p.coin}</span>
                </div>

                {/* diverging bar */}
                <div className="relative h-4" style={{ backgroundColor: "var(--bg-row)" }}>
                  <span className="absolute top-0 bottom-0" style={{ left: "50%", width: 1, backgroundColor: "var(--grid-strong)" }} />
                  <span
                    className="absolute top-0 bottom-0"
                    style={{
                      backgroundColor: barColor,
                      width: `${widthPct}%`,
                      left: up ? "50%" : `${50 - widthPct}%`,
                      opacity: 0.85,
                    }}
                  />
                </div>

                {/* change */}
                <span className="tabular text-right text-sm font-bold" style={{ color: barColor }}>
                  {up ? "+" : ""}{change.toFixed(2)}%
                </span>

                {/* price */}
                <span className="tabular text-right text-sm" style={{ color: "var(--text)" }}>
                  {fmt(p.value, currency)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
