import { useMemo, useState } from "react";
import { useCoins } from "../hooks/useCoins";
import { volatility } from "../../domain/indicators";
import { colorForSymbol } from "../../domain/price";
import CoinIcon from "./CoinIcon";

const SHOW_OPTIONS = [10, 15, 25] as const;

/** Ranks tracked coins by realized 7-day volatility (σ of hourly returns,
 *  shown annualized-free as a plain %) — the risk companion to the
 *  correlation matrix. */
export default function VolatilityRank() {
  const { coins, loading } = useCoins();
  const [show, setShow] = useState<(typeof SHOW_OPTIONS)[number]>(10);

  const ranked = useMemo(() => {
    return coins
      .filter((c) => (c.sparkline7d?.length ?? 0) > 24)
      .map((c) => ({
        meta: c,
        vol: volatility(c.sparkline7d as number[]) * 100, // % per hour step
      }))
      .sort((a, b) => b.vol - a.vol)
      .slice(0, show);
  }, [coins, show]);

  const max = ranked[0]?.vol ?? 1;

  return (
    <div className="border" style={{ borderColor: "var(--grid-strong)", backgroundColor: "var(--bg-panel)" }}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3" style={{ borderColor: "var(--grid)" }}>
        <span className="label" style={{ color: "var(--text-faint)" }}>
          σ OF HOURLY RETURNS OVER 7 DAYS · CALM COINS SIT LOW, WILD ONES TOP THE LIST
        </span>
        <div className="flex gap-px" style={{ backgroundColor: "var(--grid)" }}>
          {SHOW_OPTIONS.map((k) => (
            <button
              key={k}
              onClick={() => setShow(k)}
              className="px-4 py-1.5 text-xs font-bold uppercase tracking-wider"
              style={{
                backgroundColor: show === k ? "var(--color-accent)" : "var(--bg-row)",
                color: show === k ? "#050506" : "var(--text-dim)",
              }}
            >
              TOP {k}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-1.5 px-4 py-4">
        {loading && ranked.length === 0 ? (
          <span className="shimmer block h-[260px] w-full rounded" />
        ) : ranked.length === 0 ? (
          <p className="label py-12 text-center">NO SPARKLINE DATA YET</p>
        ) : (
          ranked.map(({ meta, vol }, i) => (
            <a
              key={meta.symbol}
              href={`/coin?symbol=${meta.symbol}`}
              className="flex items-center gap-3"
              style={{ textDecoration: "none" }}
              title={`${meta.name} — open detail`}
            >
              <span className="label w-6 text-right" style={{ color: "var(--text-faint)" }}>{i + 1}</span>
              <CoinIcon meta={meta} symbol={meta.symbol} size={16} />
              <span className="w-14 text-xs font-extrabold" style={{ color: colorForSymbol(meta.symbol) }}>
                {meta.symbol}
              </span>
              <span className="relative h-4 flex-1 overflow-hidden" style={{ backgroundColor: "var(--bg-row)" }}>
                <span
                  className="absolute inset-y-0 left-0"
                  style={{
                    width: `${Math.max(2, (vol / max) * 100)}%`,
                    backgroundColor: colorForSymbol(meta.symbol),
                    opacity: 0.85,
                  }}
                />
              </span>
              <span className="tabular w-16 text-right text-xs font-bold" style={{ color: "var(--text)" }}>
                {vol.toFixed(2)}%
              </span>
            </a>
          ))
        )}
      </div>
    </div>
  );
}
