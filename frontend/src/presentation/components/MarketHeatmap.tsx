import { useEffect, useMemo, useRef, useState } from "react";
import { useCoins } from "../hooks/useCoins";
import { squarify } from "../../domain/treemap";
import type { CoinMeta } from "../../domain/price";

type SizeBy = "mcap" | "vol";

const MAX_ABS_CHANGE = 8; // % change at which the tile color saturates

/** Blend the panel background toward green/red by 24h change magnitude. */
function tileColor(change: number | null): string {
  if (change === null || Number.isNaN(change)) return "rgb(24,26,29)";
  const t = Math.pow(Math.min(Math.abs(change) / MAX_ABS_CHANGE, 1), 0.65);
  const from: [number, number, number] = [17, 19, 22];
  const to: [number, number, number] =
    change >= 0 ? [13, 128, 76] : [168, 43, 52];
  const mix = from.map((f, i) => Math.round(f + (to[i] - f) * t));
  return `rgb(${mix[0]},${mix[1]},${mix[2]})`;
}

function fmtCompact(n: number | null): string {
  if (n === null || Number.isNaN(n)) return "—";
  const a = Math.abs(n);
  if (a >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (a >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (a >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  return `$${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

interface Hover {
  meta: CoinMeta;
  px: number;
  py: number;
}

export default function MarketHeatmap() {
  const { coins, loading } = useCoins();
  const [sizeBy, setSizeBy] = useState<SizeBy>("mcap");
  const [hover, setHover] = useState<Hover | null>(null);

  // Responsive width via ResizeObserver, same pattern as the candle chart.
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(960);
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w) setWidth(Math.max(320, Math.floor(w)));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const height = Math.round(Math.min(560, Math.max(300, width * 0.42)));

  const tiles = useMemo(() => {
    const weightOf = (m: CoinMeta) =>
      sizeBy === "mcap" ? m.marketCap : m.volume24h;
    const eligible = coins
      .filter((m) => (weightOf(m) ?? 0) > 0)
      .sort((a, b) => (weightOf(b) ?? 0) - (weightOf(a) ?? 0));
    const rects = squarify(
      eligible.map((m) => weightOf(m) as number),
      { x: 0, y: 0, w: width, h: height },
    );
    return eligible.map((meta, i) => ({ meta, rect: rects[i] }));
  }, [coins, sizeBy, width, height]);

  return (
    <div
      className="border"
      style={{ borderColor: "var(--grid-strong)", backgroundColor: "var(--bg-panel)" }}
    >
      <div
        className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3"
        style={{ borderColor: "var(--grid)" }}
      >
        <span className="label" style={{ color: "var(--text-faint)" }}>
          SIZE = {sizeBy === "mcap" ? "MARKET CAP" : "24H VOLUME"} · COLOR = 24H CHANGE · CLICK A TILE FOR DETAIL
        </span>
        <div className="flex items-center gap-3">
          <div className="flex gap-px" style={{ backgroundColor: "var(--grid)" }}>
            {(["mcap", "vol"] as const).map((k) => (
              <button
                key={k}
                onClick={() => setSizeBy(k)}
                className="px-4 py-1.5 text-xs font-bold uppercase tracking-wider"
                style={{
                  backgroundColor: sizeBy === k ? "var(--color-accent)" : "var(--bg-row)",
                  color: sizeBy === k ? "#050506" : "var(--text-dim)",
                }}
              >
                {k === "mcap" ? "MCAP" : "VOLUME"}
              </button>
            ))}
          </div>
          <div className="hidden items-center gap-1 sm:flex">
            <span className="label" style={{ color: "var(--color-down)" }}>-{MAX_ABS_CHANGE}%</span>
            {[-8, -4, -1.5, 0, 1.5, 4, 8].map((v) => (
              <span
                key={v}
                style={{ width: 14, height: 10, backgroundColor: tileColor(v), display: "inline-block" }}
              />
            ))}
            <span className="label" style={{ color: "var(--color-up)" }}>+{MAX_ABS_CHANGE}%</span>
          </div>
        </div>
      </div>

      <div ref={wrapRef} className="relative px-2 py-2">
        {loading && tiles.length === 0 ? (
          <span className="shimmer block w-full rounded" style={{ height }} />
        ) : tiles.length === 0 ? (
          <p className="label py-16 text-center">NO MARKET DATA YET</p>
        ) : (
          <svg
            viewBox={`0 0 ${width} ${height}`}
            width="100%"
            height={height}
            role="img"
            aria-label="Market heatmap treemap"
            onMouseLeave={() => setHover(null)}
          >
            {tiles.map(({ meta, rect }) => {
              const pad = 1;
              const w = Math.max(0, rect.w - pad * 2);
              const h = Math.max(0, rect.h - pad * 2);
              if (w < 2 || h < 2) return null;
              const short = Math.min(w, h);
              const symSize = Math.max(9, Math.min(26, Math.sqrt(w * h) / 5.5));
              const showSym = short > 22 && w > symSize * (meta.symbol.length * 0.7);
              const showChg = showSym && short > 40;
              const chg = meta.change24h;
              return (
                <a key={meta.symbol} href={`/coin?symbol=${meta.symbol}`}>
                  <g
                    onMouseMove={(e) => {
                      const box = wrapRef.current?.getBoundingClientRect();
                      setHover({
                        meta,
                        px: e.clientX - (box?.left ?? 0),
                        py: e.clientY - (box?.top ?? 0),
                      });
                    }}
                  >
                    <rect
                      x={rect.x + pad}
                      y={rect.y + pad}
                      width={w}
                      height={h}
                      fill={tileColor(chg)}
                      stroke="var(--bg-panel)"
                      strokeWidth={1}
                    />
                    {showSym && (
                      <text
                        x={rect.x + rect.w / 2}
                        y={rect.y + rect.h / 2 + (showChg ? -symSize * 0.25 : symSize * 0.35)}
                        textAnchor="middle"
                        fontFamily='"Archivo", monospace'
                        fontWeight={800}
                        fontSize={symSize}
                        fill="rgba(240,244,248,0.92)"
                      >
                        {meta.symbol}
                      </text>
                    )}
                    {showChg && chg !== null && (
                      <text
                        x={rect.x + rect.w / 2}
                        y={rect.y + rect.h / 2 + symSize * 0.85}
                        textAnchor="middle"
                        fontFamily='"Archivo", monospace'
                        fontWeight={700}
                        fontSize={Math.max(8, symSize * 0.55)}
                        fill={chg >= 0 ? "#8effc9" : "#ffb3ba"}
                      >
                        {chg >= 0 ? "+" : ""}
                        {chg.toFixed(2)}%
                      </text>
                    )}
                  </g>
                </a>
              );
            })}
          </svg>
        )}

        {hover && (
          <div
            className="pointer-events-none absolute z-10 border px-3 py-2"
            style={{
              left: Math.min(hover.px + 12, width - 190),
              top: hover.py + 12,
              backgroundColor: "var(--bg-row)",
              borderColor: "var(--grid-strong)",
              minWidth: 178,
            }}
          >
            <div className="text-sm font-extrabold" style={{ color: "var(--text)" }}>
              {hover.meta.symbol}
              <span className="ml-2 label">{hover.meta.name}</span>
            </div>
            <div className="label mt-1" style={{ color: "var(--text-dim)" }}>
              MCAP {fmtCompact(hover.meta.marketCap)} · VOL {fmtCompact(hover.meta.volume24h)}
            </div>
            <div
              className="mt-0.5 text-xs font-bold"
              style={{
                color:
                  (hover.meta.change24h ?? 0) >= 0 ? "var(--color-up)" : "var(--color-down)",
              }}
            >
              {hover.meta.change24h === null
                ? "24H —"
                : `24H ${hover.meta.change24h >= 0 ? "+" : ""}${hover.meta.change24h.toFixed(2)}%`}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
