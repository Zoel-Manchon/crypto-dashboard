import { useMemo, useState } from "react";
import { useCoins } from "../hooks/useCoins";
import { totalReturn, volatility } from "../../domain/indicators";
import { colorForSymbol } from "../../domain/price";

/** 7-day risk (σ of hourly returns) vs 7-day return — each coin as a dot.
 *  Top-left = calm winners, bottom-right = wild losers. */
export default function RiskReturnScatter() {
  const { coins, loading } = useCoins();
  const [hover, setHover] = useState<string | null>(null);

  const pts = useMemo(
    () =>
      coins
        .filter((c) => (c.sparkline7d?.length ?? 0) > 24)
        .map((c) => ({
          symbol: c.symbol,
          name: c.name,
          vol: volatility(c.sparkline7d as number[]) * 100,
          ret: totalReturn(c.sparkline7d as number[]),
        })),
    [coins],
  );

  const W = 860;
  const H = 380;
  const PAD = { l: 52, r: 16, t: 14, b: 34 };
  const maxVol = Math.max(0.1, ...pts.map((p) => p.vol)) * 1.08;
  const maxAbsRet = Math.max(2, ...pts.map((p) => Math.abs(p.ret))) * 1.12;
  const x = (v: number) => PAD.l + (v / maxVol) * (W - PAD.l - PAD.r);
  const y = (r: number) => PAD.t + (1 - (r + maxAbsRet) / (2 * maxAbsRet)) * (H - PAD.t - PAD.b);

  const hovered = pts.find((p) => p.symbol === hover) ?? null;

  return (
    <div className="border" style={{ borderColor: "var(--grid-strong)", backgroundColor: "var(--bg-panel)" }}>
      <div className="border-b px-4 py-3" style={{ borderColor: "var(--grid)" }}>
        <span className="label" style={{ color: "var(--text-faint)" }}>
          X = 7D VOLATILITY (σ HOURLY) · Y = 7D RETURN · TOP-LEFT CALM WINNERS · BOTTOM-RIGHT WILD LOSERS
        </span>
      </div>
      <div className="overflow-x-auto px-2 py-2">
        {loading && pts.length === 0 ? (
          <span className="shimmer block w-full rounded" style={{ height: H }} />
        ) : pts.length === 0 ? (
          <p className="label py-16 text-center">NO SPARKLINE DATA YET</p>
        ) : (
          <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} role="img" aria-label="Risk vs return scatter" onMouseLeave={() => setHover(null)}>
            {/* zero-return line + axes */}
            <line x1={PAD.l} y1={y(0)} x2={W - PAD.r} y2={y(0)} stroke="var(--grid-strong)" strokeDasharray="4 4" />
            <line x1={PAD.l} y1={PAD.t} x2={PAD.l} y2={H - PAD.b} stroke="var(--grid)" />
            <line x1={PAD.l} y1={H - PAD.b} x2={W - PAD.r} y2={H - PAD.b} stroke="var(--grid)" />
            {[0.25, 0.5, 0.75, 1].map((f) => (
              <text key={f} x={x(maxVol * f)} y={H - PAD.b + 16} textAnchor="middle" fontSize={9} fontFamily="Archivo" fill="var(--text-faint)">
                {(maxVol * f).toFixed(2)}%
              </text>
            ))}
            {[-maxAbsRet, 0, maxAbsRet].map((r) => (
              <text key={r} x={PAD.l - 8} y={y(r) + 3} textAnchor="end" fontSize={9} fontFamily="Archivo" fill={r > 0 ? "var(--color-up)" : r < 0 ? "var(--color-down)" : "var(--text-faint)"}>
                {r === 0 ? "0" : `${r > 0 ? "+" : ""}${r.toFixed(1)}%`}
              </text>
            ))}
            {/* dots */}
            {pts.map((p) => {
              const dim = hover !== null && hover !== p.symbol;
              return (
                <a key={p.symbol} href={`/coin?symbol=${p.symbol}`}>
                  <g onMouseEnter={() => setHover(p.symbol)} opacity={dim ? 0.3 : 1}>
                    <circle cx={x(p.vol)} cy={y(p.ret)} r={hover === p.symbol ? 9 : 6.5} fill={colorForSymbol(p.symbol)} stroke="var(--bg-panel)" strokeWidth={1.5} />
                    <text x={x(p.vol)} y={y(p.ret) - 11} textAnchor="middle" fontSize={9} fontWeight={800} fontFamily="Archivo" fill="var(--text-dim)">
                      {p.symbol}
                    </text>
                  </g>
                </a>
              );
            })}
            {hovered && (
              <text x={W - PAD.r} y={PAD.t + 10} textAnchor="end" fontSize={11} fontWeight={800} fontFamily="Archivo" fill="var(--text)">
                {hovered.symbol} · σ {hovered.vol.toFixed(2)}% · 7D {hovered.ret >= 0 ? "+" : ""}{hovered.ret.toFixed(2)}%
              </text>
            )}
          </svg>
        )}
      </div>
    </div>
  );
}
