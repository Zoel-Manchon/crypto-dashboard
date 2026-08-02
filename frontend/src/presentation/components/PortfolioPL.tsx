import { useEffect, useMemo, useState } from "react";
import { useLivePrices } from "../hooks/useLivePrices";
import { useCoins } from "../hooks/useCoins";
import { useLocalState } from "../hooks/useLocalState";
import CoinIcon from "./CoinIcon";

interface Holding {
  id: string;
  coin: string;
  amount: number;
  avg: number; // average cost in USD
}

const usd = (n: number) =>
  "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function PortfolioPL() {
  const { prices, live } = useLivePrices();
  const { coins, bySymbol } = useCoins();
  const [holdings, setHoldings] = useLocalState<Holding[]>("cw.holdings", []);

  const [coin, setCoin] = useState("");
  const [amount, setAmount] = useState("");
  const [avg, setAvg] = useState("");

  useEffect(() => {
    if (!coin && coins.length > 0) setCoin(coins[0].symbol);
  }, [coins, coin]);

  const priceOf = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of prices) if (p.currency === "USD") m.set(p.coin, Number(p.value));
    return m;
  }, [prices]);

  const rows = useMemo(
    () =>
      holdings.map((h) => {
        const price = priceOf.get(h.coin) ?? h.avg;
        const cost = h.amount * h.avg;
        const value = h.amount * price;
        const pnl = value - cost;
        return { ...h, price, value, cost, pnl, pnlPct: cost > 0 ? (pnl / cost) * 100 : 0 };
      }),
    [holdings, priceOf],
  );

  const totals = useMemo(() => {
    const value = rows.reduce((s, r) => s + r.value, 0);
    const cost = rows.reduce((s, r) => s + r.cost, 0);
    const pnl = value - cost;
    return { value, cost, pnl, pnlPct: cost > 0 ? (pnl / cost) * 100 : 0 };
  }, [rows]);

  function add() {
    const a = Number(amount);
    const c = Number(avg);
    if (!coin || Number.isNaN(a) || a <= 0 || Number.isNaN(c) || c <= 0) return;
    const id = crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
    setHoldings((prev) => [...prev, { id, coin, amount: a, avg: c }]);
    setAmount("");
    setAvg("");
  }
  function remove(id: string) {
    setHoldings((prev) => prev.filter((h) => h.id !== id));
  }

  const inputStyle = { backgroundColor: "var(--bg-row)", color: "var(--text)", border: "1px solid var(--grid-strong)" };
  const pnlColor = (v: number) => (v >= 0 ? "var(--color-up)" : "var(--color-down)");

  return (
    <div className="border" style={{ borderColor: "var(--grid-strong)", backgroundColor: "var(--bg-panel)" }}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3" style={{ borderColor: "var(--grid)" }}>
        <div className="flex items-center gap-3">
          <span className="label">PORTFOLIO</span>
          <span className="label" style={{ color: live ? "var(--color-up)" : "var(--text-faint)" }}>{live ? "● LIVE P/L" : "○ SNAPSHOT"}</span>
        </div>
        {rows.length > 0 && (
          <div className="flex items-baseline gap-4">
            <span className="tabular text-lg font-bold">{usd(totals.value)}</span>
            <span className="tabular text-sm font-bold" style={{ color: pnlColor(totals.pnl) }}>
              {totals.pnl >= 0 ? "+" : ""}{usd(totals.pnl)} ({totals.pnlPct >= 0 ? "+" : ""}{totals.pnlPct.toFixed(2)}%)
            </span>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-end gap-2 border-b px-4 py-3" style={{ borderColor: "var(--grid)" }}>
        <select value={coin} onChange={(e) => setCoin(e.target.value)} className="px-3 py-1.5 text-sm font-bold" style={inputStyle}>
          {coins.map((c) => <option key={c.symbol} value={c.symbol}>{c.symbol}</option>)}
        </select>
        <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="AMOUNT"
          className="w-28 px-3 py-1.5 text-sm font-bold outline-none" style={inputStyle} />
        <input value={avg} onChange={(e) => setAvg(e.target.value)} inputMode="decimal" placeholder="AVG COST $"
          onKeyDown={(e) => e.key === "Enter" && add()}
          className="w-32 px-3 py-1.5 text-sm font-bold outline-none" style={inputStyle} />
        <button onClick={add} className="px-4 py-1.5 text-xs font-bold uppercase tracking-wider" style={{ backgroundColor: "var(--color-accent)", color: "#050506" }}>+ ADD</button>
      </div>

      {rows.length === 0 ? (
        <p className="label px-4 py-6">NO HOLDINGS — add a coin, amount, and average cost to track live P/L (USD).</p>
      ) : (
        <div>
          <div className="grid gap-3 px-4 py-2 label" style={{ gridTemplateColumns: "130px 1fr 1fr 1fr 40px", color: "var(--text-faint)" }}>
            <span>COIN</span><span className="text-right">PRICE</span><span className="text-right">VALUE</span><span className="text-right">P/L</span><span />
          </div>
          {rows.map((r) => (
            <div key={r.id} className="grid items-center gap-3 px-4 py-2.5" style={{ gridTemplateColumns: "130px 1fr 1fr 1fr 40px", borderTop: "1px solid var(--grid)" }}>
              <div className="flex items-center gap-2 min-w-0">
                <CoinIcon meta={bySymbol[r.coin]} symbol={r.coin} size={16} />
                <span className="text-sm font-bold" style={{ color: bySymbol[r.coin]?.color }}>{r.coin}</span>
                <span className="label" style={{ color: "var(--text-faint)" }}>{r.amount}</span>
              </div>
              <span className="tabular text-right text-sm">{usd(r.price)}</span>
              <span className="tabular text-right text-sm">{usd(r.value)}</span>
              <span className="tabular text-right text-sm font-bold" style={{ color: pnlColor(r.pnl) }}>
                {r.pnl >= 0 ? "+" : ""}{r.pnlPct.toFixed(1)}%
              </span>
              <button onClick={() => remove(r.id)} className="label text-right" style={{ color: "var(--text-faint)" }} title="Remove">✕</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
