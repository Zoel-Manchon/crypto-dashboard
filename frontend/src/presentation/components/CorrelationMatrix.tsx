import { useEffect, useMemo, useRef, useState } from "react";
import { useCoins } from "../hooks/useCoins";
import { correlationMatrix } from "../../domain/correlation";

const COUNT_OPTIONS = [8, 12, 16] as const;
const LABEL_W = 52;
const LABEL_H = 20;

/** Diverging color: -1 red, 0 neutral panel, +1 green. */
function cellColor(r: number): string {
  const t = Math.pow(Math.min(Math.abs(r), 1), 0.9);
  const from: [number, number, number] = [17, 19, 22];
  const to: [number, number, number] = r >= 0 ? [13, 128, 76] : [168, 43, 52];
  const mix = from.map((f, i) => Math.round(f + (to[i] - f) * t));
  return `rgb(${mix[0]},${mix[1]},${mix[2]})`;
}

interface Hover {
  a: string;
  b: string;
  r: number;
  px: number;
  py: number;
}

export default function CorrelationMatrix() {
  const { coins, loading } = useCoins();
  const [count, setCount] = useState<(typeof COUNT_OPTIONS)[number]>(12);
  const [hover, setHover] = useState<Hover | null>(null);

  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(860);
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w) setWidth(Math.max(360, Math.floor(w)));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const { symbols, matrix } = useMemo(() => {
    const eligible = coins
      .filter((c) => (c.sparkline7d?.length ?? 0) > 24)
      .slice()
      .sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999))
      .slice(0, count);
    return {
      symbols: eligible.map((c) => c.symbol),
      matrix: correlationMatrix(eligible.map((c) => c.sparkline7d as number[])),
    };
  }, [coins, count]);

  const n = symbols.length;
  const cell = n > 0 ? Math.max(18, Math.min(46, (width - LABEL_W - 8) / n)) : 0;
  const gridW = LABEL_W + n * cell;
  const gridH = LABEL_H + n * cell;

  return (
    <div className="border" style={{ borderColor: "var(--grid-strong)", backgroundColor: "var(--bg-panel)" }}>
      <div
        className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3"
        style={{ borderColor: "var(--grid)" }}
      >
        <span className="label" style={{ color: "var(--text-faint)" }}>
          PEARSON r · 7-DAY HOURLY USD SERIES · GREEN MOVES TOGETHER, RED MOVES OPPOSITE
        </span>
        <div className="flex items-center gap-3">
          <div className="flex gap-px" style={{ backgroundColor: "var(--grid)" }}>
            {COUNT_OPTIONS.map((k) => (
              <button
                key={k}
                onClick={() => setCount(k)}
                className="px-4 py-1.5 text-xs font-bold uppercase tracking-wider"
                style={{
                  backgroundColor: count === k ? "var(--color-accent)" : "var(--bg-row)",
                  color: count === k ? "#050506" : "var(--text-dim)",
                }}
              >
                TOP {k}
              </button>
            ))}
          </div>
          <div className="hidden items-center gap-1 sm:flex">
            <span className="label" style={{ color: "var(--color-down)" }}>-1</span>
            {[-1, -0.5, 0, 0.5, 1].map((v) => (
              <span key={v} style={{ width: 14, height: 10, backgroundColor: cellColor(v), display: "inline-block" }} />
            ))}
            <span className="label" style={{ color: "var(--color-up)" }}>+1</span>
          </div>
        </div>
      </div>

      <div ref={wrapRef} className="relative overflow-x-auto px-3 py-3">
        {loading && n === 0 ? (
          <span className="shimmer block w-full rounded" style={{ height: 320 }} />
        ) : n === 0 ? (
          <p className="label py-16 text-center">NO SPARKLINE DATA YET</p>
        ) : (
          <svg
            viewBox={`0 0 ${gridW} ${gridH}`}
            width={gridW}
            height={gridH}
            role="img"
            aria-label="Coin correlation matrix"
            onMouseLeave={() => setHover(null)}
          >
            {/* column labels */}
            {symbols.map((s, j) => (
              <text
                key={`c${s}`}
                x={LABEL_W + j * cell + cell / 2}
                y={LABEL_H - 7}
                textAnchor="middle"
                fontSize={Math.min(10, cell * 0.42)}
                fontFamily='"Archivo", monospace'
                fontWeight={700}
                fill="var(--text-dim)"
              >
                {s}
              </text>
            ))}
            {/* rows */}
            {symbols.map((rowSym, i) => (
              <g key={`r${rowSym}`}>
                <text
                  x={LABEL_W - 6}
                  y={LABEL_H + i * cell + cell / 2 + 3}
                  textAnchor="end"
                  fontSize={Math.min(10, cell * 0.42)}
                  fontFamily='"Archivo", monospace'
                  fontWeight={700}
                  fill="var(--text-dim)"
                >
                  {rowSym}
                </text>
                {symbols.map((colSym, j) => {
                  const r = matrix[i][j];
                  return (
                    <g key={`${rowSym}-${colSym}`}>
                      <rect
                        x={LABEL_W + j * cell}
                        y={LABEL_H + i * cell}
                        width={cell - 1}
                        height={cell - 1}
                        fill={cellColor(r)}
                        stroke="var(--bg-panel)"
                        strokeWidth={1}
                        onMouseMove={(e) => {
                          const box = wrapRef.current?.getBoundingClientRect();
                          setHover({
                            a: rowSym,
                            b: colSym,
                            r,
                            px: e.clientX - (box?.left ?? 0),
                            py: e.clientY - (box?.top ?? 0),
                          });
                        }}
                      />
                      {cell >= 30 && (
                        <text
                          x={LABEL_W + j * cell + (cell - 1) / 2}
                          y={LABEL_H + i * cell + cell / 2 + 3}
                          textAnchor="middle"
                          fontSize={cell * 0.28}
                          fontFamily='"Archivo", monospace'
                          fill="rgba(240,244,248,0.75)"
                          pointerEvents="none"
                        >
                          {i === j ? "1" : r.toFixed(2).replace("0.", ".")}
                        </text>
                      )}
                    </g>
                  );
                })}
              </g>
            ))}
          </svg>
        )}

        {hover && (
          <div
            className="pointer-events-none absolute z-10 border px-3 py-2"
            style={{
              left: Math.min(hover.px + 12, width - 170),
              top: hover.py + 12,
              backgroundColor: "var(--bg-row)",
              borderColor: "var(--grid-strong)",
              minWidth: 158,
            }}
          >
            <div className="text-sm font-extrabold" style={{ color: "var(--text)" }}>
              {hover.a} × {hover.b}
            </div>
            <div
              className="mt-0.5 text-xs font-bold"
              style={{ color: hover.r >= 0 ? "var(--color-up)" : "var(--color-down)" }}
            >
              r = {hover.r.toFixed(3)}
            </div>
            <div className="label mt-0.5" style={{ color: "var(--text-faint)" }}>
              {Math.abs(hover.r) > 0.8
                ? "STRONG"
                : Math.abs(hover.r) > 0.5
                  ? "MODERATE"
                  : Math.abs(hover.r) > 0.2
                    ? "WEAK"
                    : "NEGLIGIBLE"}{" "}
              {hover.r >= 0 ? "POSITIVE" : "NEGATIVE"}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
