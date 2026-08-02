import { useCoins } from "../../hooks/useCoins";
import { useLivePrices } from "../../hooks/useLivePrices";
import { arrow, dirColor, usd } from "./format";

/**
 * The tape. Runs the tracked set twice and translates the strip -50%, so the
 * loop closes without a seam. It is the first thing on screen because it is the
 * one element that proves the terminal is live before you read anything else.
 */
export default function TickerTape() {
  const { coins } = useCoins();
  const { prices } = useLivePrices();

  const live = new Map<string, number>();
  for (const p of prices) {
    if (p.currency === "USD") live.set(p.coin, Number(p.value));
  }

  const items = coins
    .filter((c) => live.has(c.symbol) || c.change24h !== null)
    .map((c) => ({
      sym: c.symbol,
      price: live.has(c.symbol) ? usd(live.get(c.symbol) as number) : "—",
      chg: c.change24h ?? 0,
    }));

  if (items.length === 0) return <div className="cw-tape" style={{ height: 32 }} />;

  const run = [...items, ...items];

  return (
    <div className="cw-tape">
      <div className="cw-tape__run">
        {run.map((t, i) => (
          <span className="cw-tape__item" key={`${t.sym}-${i}`}>
            <span className="cw-tape__sym">{t.sym}</span>
            <span>{t.price}</span>
            <span style={{ fontWeight: 800, color: dirColor(t.chg) }}>{arrow(t.chg)}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
