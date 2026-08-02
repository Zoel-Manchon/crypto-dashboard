import type { CoinMeta } from "../../../domain/price";
import { Panel } from "./Panel";

/**
 * Breadth + fear & greed.
 *
 * The index is derived from the tracked set itself — average 24h move plus the
 * advance/decline spread — not fetched from an external sentiment API. It is a
 * read of *this* market, and the label says so.
 */
export default function Breadth({ coins }: { coins: CoinMeta[] }) {
  const changed = coins.filter((c) => c.change24h !== null);
  const advancers = changed.filter((c) => (c.change24h as number) >= 0).length;
  const decliners = changed.length - advancers;
  const avg = changed.length
    ? changed.reduce((a, c) => a + (c.change24h as number), 0) / changed.length
    : 0;
  const upPct = changed.length ? (advancers / changed.length) * 100 : 50;
  const fear = Math.max(
    2,
    Math.min(98, Math.round(50 + avg * 9 + (advancers - decliners) * 2)),
  );
  const label = fear > 66 ? "greed" : fear < 34 ? "fear" : "neutral";

  return (
    <Panel title="Breadth">
      <div
        className="mb-1.5 flex justify-between"
        style={{ fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase" }}
      >
        <span>▲ {advancers} advancing</span>
        <span style={{ color: "var(--cw-down)" }}>{decliners} declining ▼</span>
      </div>
      <div className="flex" style={{ height: 16, background: "var(--cw-grid)" }}>
        <div style={{ width: `${upPct}%`, background: "var(--cw-up)" }} />
        <div style={{ flex: 1, background: "var(--cw-down)" }} />
      </div>

      <div className="label" style={{ marginTop: 20 }}>
        Fear &amp; greed
      </div>
      <div
        style={{
          position: "relative",
          height: 16,
          marginTop: 6,
          background:
            "linear-gradient(90deg, var(--cw-down) 0%, var(--cw-grid2) 50%, var(--cw-up) 100%)",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: -4,
            bottom: -4,
            width: 3,
            left: `${fear}%`,
            background: "var(--cw-bg)",
            outline: "1px solid var(--cw-accent)",
          }}
        />
      </div>
      <div
        className="flex justify-between"
        style={{
          fontSize: 9,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: "var(--cw-dim)",
          marginTop: 4,
        }}
      >
        <span>fear</span>
        <span>neutral</span>
        <span>greed</span>
      </div>
      <div style={{ fontSize: 30, fontWeight: 800, marginTop: 8 }}>
        {fear}{" "}
        <span
          style={{
            fontSize: 12,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            color: "var(--cw-dim)",
          }}
        >
          {label}
        </span>
      </div>
      <p style={{ fontSize: 11, color: "var(--cw-dim)", marginTop: 8 }}>
        Derived from the tracked set — average 24h move and the advance/decline spread.
      </p>
    </Panel>
  );
}
