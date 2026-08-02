import { type Coin } from "../../domain/price";

const SHARES: Array<[Coin | "USDT" | "Others", number, string]> = [
  ["BTC", 52.31, "#ff9f0a"], ["ETH", 16.42, "#9b5cff"], ["USDT", 5.21, "#2fd1c5"], ["BNB", 3.12, "#f3ba2f"],
  ["SOL", 2.71, "#14f195"], ["XRP", 2.35, "#ff7f7f"], ["ADA", 1.24, "#3c7cff"], ["DOGE", 0.98, "#d0b84f"], ["Others", 15.66, "#8d96a8"],
];

export default function PriceOverview() {
  let offset = 0;
  const gradient = SHARES.map(([_, pct, color]) => { const start = offset; offset += pct; return `${color} ${start}% ${offset}%`; }).join(", ");
  return (
    <section className="panel px-5 py-5">
      <h2 className="text-base font-black">PRICE OVERVIEW (USD)</h2>
      <p className="mt-1 text-sm" style={{ color: "var(--text-dim)" }}>12 Coins</p>
      <div className="mt-6 grid grid-cols-[1fr_150px] items-center gap-4 max-sm:grid-cols-1">
        <div className="mx-auto aspect-square w-full max-w-[260px] rounded-full" style={{ background: `conic-gradient(${gradient})`, padding: 34 }}><div className="h-full w-full rounded-full" style={{ background: "var(--bg-panel)" }} /></div>
        <div className="space-y-3">
          {SHARES.map(([coin, pct, color]) => <div key={coin} className="flex items-center justify-between gap-3 text-sm"><span className="flex items-center gap-2"><span className="h-3 w-3 rounded-full" style={{ background: color }} />{coin}</span><span className="tabular font-bold">{pct.toFixed(2)}%</span></div>)}
        </div>
      </div>
    </section>
  );
}
