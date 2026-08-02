import { useState } from "react";
import type { CoinMeta } from "../../../domain/price";
import { useLiveCandles } from "../../hooks/useLiveCandles";
import { usePriceFlash } from "../../hooks/usePriceFlash";
import { compact, dirColor, pct, usd } from "./format";

/**
 * The hero. One pair, priced at 104px.
 *
 * Everything else on this screen is 10-13px, so the spot price is roughly ten
 * times the size of its own label — that ratio is the whole point: from across
 * the room you read the number, and only up close do you read the terminal.
 *
 * The candles underneath are aggregated from the live tape, not fetched, so
 * they start moving the moment the stream connects instead of waiting on the
 * backend's poll interval.
 */

const BUCKETS = [
  { label: "1s", ms: 1_000 },
  { label: "5s", ms: 5_000 },
  { label: "15s", ms: 15_000 },
  { label: "1m", ms: 60_000 },
] as const;

export default function MarketHero({
  coin,
  live,
}: {
  coin: CoinMeta | undefined;
  live: number | undefined;
}) {
  const [bucketMs, setBucketMs] = useState<number>(5_000);
  const { candles } = useLiveCandles(coin?.symbol ?? "", bucketMs, live);
  const { dir, flashing, sessionDelta } = usePriceFlash(live);

  if (!coin) {
    return (
      <section className="min-w-0">
        <div className="cw-body label">Loading market…</div>
      </section>
    );
  }

  const change = coin.change24h;
  const price = live ?? null;

  // The headline takes the direction colour only while flashing, then settles
  // back to ink — a price that stayed green would stop meaning "just rose".
  const priceColor = flashing
    ? dir === "up"
      ? "var(--cw-up)"
      : "var(--cw-down)"
    : "var(--cw-fg)";

  const lo = candles.length ? Math.min(...candles.map((c) => c.l)) : 0;
  const hi = candles.length ? Math.max(...candles.map((c) => c.h)) : 1;
  const span = hi - lo || 1;
  const y = (v: number) => ((hi - v) / span) * 100;

  const stats = [
    { label: "Window high", value: candles.length ? usd(hi) : "—" },
    { label: "Window low", value: candles.length ? usd(lo) : "—" },
    { label: "Volume 24h", value: coin.volume24h ? compact(coin.volume24h) : "—" },
    { label: "Market cap", value: coin.marketCap ? compact(coin.marketCap) : "—" },
    { label: "Rank", value: coin.rank ? `#${coin.rank}` : "—" },
  ];

  const first = candles[0];
  const last = candles[candles.length - 1];
  const range =
    first && last
      ? `${first.t.toISOString().slice(11, 19)} → ${last.t.toISOString().slice(11, 19)} UTC`
      : "—";

  return (
    <section className="min-w-0">
      <div className="flex flex-wrap items-end justify-between gap-6 px-5 pb-3 pt-5">
        <div className="min-w-0">
          <div className="flex items-baseline gap-3">
            <span style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-0.02em" }}>
              {coin.symbol}
            </span>
            <span className="label">{coin.name} · USD · spot</span>
          </div>
          <div
            style={{
              fontSize: "clamp(48px, 8vw, 104px)",
              fontWeight: 800,
              lineHeight: 0.88,
              letterSpacing: "-0.045em",
              marginTop: 8,
              color: priceColor,
              transition: "color 120ms linear",
            }}
          >
            {price === null ? "—" : usd(price)}
            {dir && (
              <span style={{ fontSize: "0.28em", marginLeft: "0.15em", color: dirColor(dir === "up" ? 1 : -1) }}>
                {dir === "up" ? "▲" : "▼"}
              </span>
            )}
          </div>
          {sessionDelta !== null && sessionDelta !== 0 && (
            <div className="label" style={{ marginTop: 6 }}>
              since open{" "}
              <span style={{ color: dirColor(sessionDelta), fontWeight: 800 }}>
                {sessionDelta >= 0 ? "+" : "−"}
                {usd(Math.abs(sessionDelta)).replace("$", "$")}
              </span>
            </div>
          )}
        </div>
        <div style={{ textAlign: "right", paddingBottom: 8 }}>
          <div
            style={{
              fontSize: 40,
              fontWeight: 800,
              lineHeight: 1,
              letterSpacing: "-0.03em",
              color: change === null ? "var(--cw-dim)" : dirColor(change),
            }}
          >
            {change === null ? "—" : pct(change)}
          </div>
          <div className="label" style={{ marginTop: 4 }}>
            24h change
          </div>
        </div>
      </div>

      <div className="flex flex-wrap" style={{ borderTop: "1px solid var(--cw-line)" }}>
        {stats.map((s) => (
          <div
            key={s.label}
            style={{
              flex: "1 1 140px",
              padding: "9px 14px",
              borderRight: "1px solid var(--cw-line)",
            }}
          >
            <div
              style={{
                fontSize: 9,
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                color: "var(--cw-dim)",
              }}
            >
              {s.label}
            </div>
            <div style={{ fontSize: 16, fontWeight: 800 }}>{s.value}</div>
          </div>
        ))}
      </div>

      <div style={{ padding: "14px 20px 18px", borderTop: "1px solid var(--cw-line)" }}>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2 label">
          <span>Candlesticks · {coin.symbol}/USD · live tape</span>
          <span className="flex items-center gap-2">
            <span>{range}</span>
            <span className="flex gap-px">
              {BUCKETS.map((b) => (
                <button
                  key={b.label}
                  className="cw-chip"
                  aria-pressed={bucketMs === b.ms}
                  onClick={() => setBucketMs(b.ms)}
                >
                  {b.label}
                </button>
              ))}
            </span>
          </span>
        </div>

        <div className="flex items-stretch gap-[3px]" style={{ height: 240 }}>
          {candles.length === 0 && (
            <div className="flex w-full flex-col items-center justify-center gap-1">
              <span className="label">Waiting for the first print…</span>
              <span style={{ fontSize: 11, color: "var(--cw-dim2)" }}>
                Each bucket is {bucketMs / 1000}s wide; the window fills in{" "}
                {Math.round((40 * bucketMs) / 1000)}s.
              </span>
            </div>
          )}
          {candles.map((c) => {
            const up = c.c >= c.o;
            const color = up ? "var(--cw-up)" : "var(--cw-down)";
            const bodyTop = y(Math.max(c.o, c.c));
            const bodyBottom = y(Math.min(c.o, c.c));
            return (
              <div
                key={c.t.getTime()}
                style={{ flex: 1, position: "relative" }}
                title={`${c.t.toISOString().slice(11, 19)} · O ${usd(c.o)} H ${usd(c.h)} L ${usd(c.l)} C ${usd(c.c)}`}
              >
                <div
                  style={{
                    position: "absolute",
                    left: "50%",
                    width: 1,
                    transform: "translateX(-50%)",
                    top: `${y(c.h)}%`,
                    height: `${Math.max(0.5, y(c.l) - y(c.h))}%`,
                    background: color,
                  }}
                />
                <div
                  style={{
                    position: "absolute",
                    left: 0,
                    right: 0,
                    top: `${bodyTop}%`,
                    height: `${Math.max(1, bodyBottom - bodyTop)}%`,
                    background: up ? color : "transparent",
                    border: `1px solid ${color}`,
                  }}
                />
              </div>
            );
          })}
        </div>

        <div
          className="mt-2 flex justify-between pt-1.5"
          style={{
            borderTop: "1px solid var(--cw-line)",
            fontSize: 10,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: "var(--cw-dim)",
          }}
        >
          <span>−{((candles.length || 1) * bucketMs) / 1000}s</span>
          <span style={{ color: "var(--cw-up)" }}>■ up</span>
          <span style={{ color: "var(--cw-down)" }}>■ down</span>
          <span>now</span>
        </div>
      </div>
    </section>
  );
}
