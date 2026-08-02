const NEWS = [
  ["Bitcoin ETF inflows reach 3-month high", "10m ago · CoinDesk", "Positive"],
  ["Ethereum upgrade ‘Pectra’ goes live on testnet", "35m ago · The Block", "Positive"],
  ["SEC delays decision on several altcoin ETFs", "1h ago · Decrypt", "Neutral"],
  ["Market volatility rises as CPI data comes in hot", "2h ago · Cointelegraph", "Negative"],
] as const;

export default function NewsSentiment() {
  return (
    <section id="news" className="panel px-5 py-5">
      <div className="mb-4 flex items-center justify-between"><h2 className="text-base font-black">📰 NEWS / SENTIMENT</h2><a className="text-sm font-bold" style={{ color: "#a77cff" }}>View all</a></div>
      <div className="space-y-2">
        {NEWS.map(([title, source, mood]) => {
          const color = mood === "Positive" ? "var(--color-up)" : mood === "Negative" ? "var(--color-down)" : "var(--text-dim)";
          return <article key={title} className="grid grid-cols-[36px_1fr_auto] items-center gap-3 rounded-md p-3" style={{ background: "rgba(255,255,255,.025)", border: "1px solid var(--grid)" }}>
            <span className="grid h-8 w-8 place-items-center rounded-md" style={{ background: "var(--bg-row)" }}>◌</span>
            <div><p className="text-sm font-bold">{title}</p><p className="text-xs" style={{ color: "var(--text-dim)" }}>{source}</p></div>
            <span className="rounded-md px-2 py-1 text-xs font-bold" style={{ background: "rgba(255,255,255,.04)", color }}>{mood}</span>
          </article>;
        })}
      </div>
    </section>
  );
}
