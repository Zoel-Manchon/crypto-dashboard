import { useEffect, useMemo, useRef, useState } from "react";
import { useLivePrices } from "../hooks/useLivePrices";
import { useCoins } from "../hooks/useCoins";
import { useLocalState } from "../hooks/useLocalState";
import CoinIcon from "./CoinIcon";
import Sparkline from "./Sparkline";
import { ALL_CURRENCIES, type Currency, type Price } from "../../domain/price";

const CURRENCY_SYMBOL: Record<Currency, string> = { USD: "$", EUR: "€", JPY: "¥", RUB: "₽" };
const CURRENCY_ORDER: Currency[] = ["USD", "EUR", "JPY", "RUB"];

type Sort = "rank" | "name" | "change" | "mcap";

function fmt(value: string, currency: Currency): string {
  const n = Number(value);
  if (Number.isNaN(n)) return value;
  return `${CURRENCY_SYMBOL[currency]}${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtCompact(n: number | null): string {
  if (n === null || Number.isNaN(n)) return "—";
  const abs = Math.abs(n);
  if (abs >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (abs >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

function PriceLine({ price }: { price: Price }) {
  const prev = useRef<string | null>(null);
  const [flash, setFlash] = useState<"up" | "down" | null>(null);

  useEffect(() => {
    if (prev.current !== null && prev.current !== price.value) {
      const dir = Number(price.value) >= Number(prev.current) ? "up" : "down";
      setFlash(dir);
      const id = window.setTimeout(() => setFlash(null), 600);
      prev.current = price.value;
      return () => window.clearTimeout(id);
    }
    prev.current = price.value;
  }, [price.value]);

  const change = price.change24h;
  const hasChange = change !== null && change !== undefined && !Number.isNaN(change);
  const valueColor = flash === "up" ? "var(--color-up)" : flash === "down" ? "var(--color-down)" : "var(--text)";
  const changeColor = hasChange && change >= 0 ? "var(--color-up)" : "var(--color-down)";

  return (
    <div className="price-line">
      <span className="price-line__currency">{price.currency}</span>
      <span className="price-line__value tabular" style={{ color: valueColor }}>{fmt(price.value, price.currency)}</span>
      <span className="price-line__change tabular" style={{ color: hasChange ? changeColor : "var(--text-faint)" }}>
        {hasChange ? `${change >= 0 ? "▲" : "▼"} ${Math.abs(change).toFixed(2)}%` : "—"}
      </span>
    </div>
  );
}

function CardSkeleton() {
  return (
    <div className="price-skeleton-card">
      <div className="mb-4 flex items-center justify-between">
        <span className="shimmer h-3 w-24 rounded" />
        <span className="shimmer h-3 w-10 rounded" />
      </div>
      <div className="flex flex-col gap-3">
        <span className="shimmer h-6 w-full rounded" />
        <span className="shimmer h-6 w-11/12 rounded" />
      </div>
    </div>
  );
}

export default function PriceCards() {
  const { prices, loading, error, live } = useLivePrices();
  const { coins, bySymbol } = useCoins();

  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>("rank");
  const [visible, setVisible] = useState<Set<Currency>>(new Set<Currency>(["USD", "EUR"]));
  const [showLogos, setShowLogos] = useLocalState<boolean>("cw.logos", true);
  const [favorites, setFavorites] = useLocalState<string[]>("cw.favorites", []);
  const [favOnly, setFavOnly] = useState(false);

  const favSet = useMemo(() => new Set(favorites), [favorites]);

  const rankOf = useMemo(() => {
    const m = new Map<string, number>();
    coins.forEach((c, i) => m.set(c.symbol, c.rank ?? i + 1));
    return m;
  }, [coins]);

  const { byCoin, changeOf } = useMemo(() => {
    const grouped = new Map<string, Price[]>();
    const change = new Map<string, number>();
    for (const price of prices) {
      const list = grouped.get(price.coin) ?? [];
      list.push(price);
      grouped.set(price.coin, list);
      if (price.currency === "USD" && price.change24h !== null) change.set(price.coin, price.change24h);
    }
    return { byCoin: grouped, changeOf: change };
  }, [prices]);

  const order = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = [...byCoin.keys()].filter((coin) => {
      if (favOnly && !favSet.has(coin)) return false;
      if (!q) return true;
      const name = bySymbol[coin]?.name?.toLowerCase() ?? "";
      return coin.toLowerCase().includes(q) || name.includes(q);
    });
    list.sort((a, b) => {
      // favorites always float to the top
      const fa = favSet.has(a) ? 0 : 1;
      const fb = favSet.has(b) ? 0 : 1;
      if (fa !== fb) return fa - fb;
      if (sort === "name") return a.localeCompare(b);
      if (sort === "change") return (changeOf.get(b) ?? -Infinity) - (changeOf.get(a) ?? -Infinity);
      if (sort === "mcap") return (bySymbol[b]?.marketCap ?? -Infinity) - (bySymbol[a]?.marketCap ?? -Infinity);
      return (rankOf.get(a) ?? 9999) - (rankOf.get(b) ?? 9999);
    });
    return list;
  }, [byCoin, bySymbol, query, sort, changeOf, rankOf, favSet, favOnly]);

  function toggleCurrency(c: Currency) {
    setVisible((prev) => {
      const next = new Set(prev);
      if (next.has(c)) { if (next.size > 1) next.delete(c); } else next.add(c);
      return next;
    });
  }

  function toggleFav(coin: string) {
    setFavorites((prev) => (prev.includes(coin) ? prev.filter((c) => c !== coin) : [...prev, coin]));
  }

  if (error) {
    return (
      <div className="price-error">
        FEED ERROR — backend offline on :8080?
        <span>{error}</span>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="price-panel">
        <div className="price-status"><span className="label blink">○ CONNECTING</span></div>
        <div className="price-grid">{Array.from({ length: 8 }).map((_, i) => <CardSkeleton key={i} />)}</div>
      </div>
    );
  }

  const btn = (active: boolean, accent = false) => ({
    backgroundColor: active ? (accent ? "var(--color-accent)" : "var(--text)") : "var(--bg-row)",
    color: active ? (accent ? "#050506" : "var(--bg)") : "var(--text-dim)",
  });

  return (
    <div className="price-panel">
      <div className="mb-3 flex flex-wrap items-center gap-3 border-b pb-3" style={{ borderColor: "var(--grid)" }}>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="SEARCH COIN…"
          className="px-3 py-1.5 text-xs font-bold uppercase tracking-wider outline-none"
          style={{ backgroundColor: "var(--bg-row)", color: "var(--text)", border: "1px solid var(--grid-strong)", minWidth: "130px" }}
        />

        <div className="flex gap-px" style={{ backgroundColor: "var(--grid)" }}>
          {(["rank", "mcap", "name", "change"] as Sort[]).map((s) => (
            <button key={s} onClick={() => setSort(s)} className="px-3 py-1.5 text-xs font-bold uppercase tracking-wider" style={btn(sort === s, true)}>
              {s === "change" ? "24H" : s === "mcap" ? "MCAP" : s}
            </button>
          ))}
        </div>

        <div className="flex gap-px" style={{ backgroundColor: "var(--grid)" }}>
          {ALL_CURRENCIES.map((c) => (
            <button key={c} onClick={() => toggleCurrency(c)} className="px-3 py-1.5 text-xs font-bold uppercase tracking-wider" style={btn(visible.has(c))}>{c}</button>
          ))}
        </div>

        <button onClick={() => setFavOnly((v) => !v)} className="px-3 py-1.5 text-xs font-bold uppercase tracking-wider" style={btn(favOnly)} title="Show favorites only">★ {favorites.length}</button>
        <button onClick={() => setShowLogos((v) => !v)} className="px-3 py-1.5 text-xs font-bold uppercase tracking-wider" style={btn(showLogos)} title="Toggle coin logos">LOGOS</button>

        <span className="label" style={{ marginLeft: "auto", color: live ? "var(--color-up)" : "var(--text-dim)" }}>
          {live ? "● STREAMING" : "○ SNAPSHOT"} · {order.length}
        </span>
      </div>

      {order.length === 0 ? (
        <p className="label px-1 py-6">{favOnly ? "NO FAVORITES YET — tap ☆ on a card" : "NO MATCHING COINS"}</p>
      ) : (
        <div className="price-grid">
          {order.map((coin) => {
            const lines = (byCoin.get(coin) ?? [])
              .filter((p) => visible.has(p.currency))
              .sort((a, b) => CURRENCY_ORDER.indexOf(a.currency) - CURRENCY_ORDER.indexOf(b.currency));
            const meta = bySymbol[coin];
            const fav = favSet.has(coin);
            return (
              <article key={coin} className="price-card">
                <header className="price-card__head" style={{ alignItems: "center" }}>
                  <div className="flex min-w-0 items-center gap-2">
                    <button
                      onClick={() => toggleFav(coin)}
                      title={fav ? "Unfavorite" : "Favorite"}
                      style={{ color: fav ? "var(--color-accent)" : "var(--text-faint)", fontSize: 13, lineHeight: 1 }}
                    >
                      {fav ? "★" : "☆"}
                    </button>
                    {showLogos && <CoinIcon meta={meta} symbol={coin} size={16} />}
                    <span className="label price-card__name truncate">{meta?.name ?? coin}</span>
                  </div>
                  <a className="price-card__ticker" href={`/coin?symbol=${coin}`} style={{ color: meta?.color, textDecoration: "none" }} title={`Open ${coin} detail`}>{coin} ↗</a>
                </header>

                {meta?.sparkline7d && meta.sparkline7d.length > 1 && (
                  <div className="my-1.5" style={{ opacity: 0.9 }}>
                    <Sparkline data={meta.sparkline7d} width={220} height={28} />
                  </div>
                )}

                <div className="price-card__lines">
                  {lines.length > 0
                    ? lines.map((price) => <PriceLine key={price.currency} price={price} />)
                    : <span className="label">SELECT A CURRENCY</span>}
                </div>

                <footer className="mt-2 flex items-center justify-between border-t pt-1.5" style={{ borderColor: "var(--grid)" }}>
                  <span className="label" style={{ color: "var(--text-faint)" }}>#{meta?.rank ?? "—"}</span>
                  <span className="tabular text-xs" style={{ color: "var(--text-dim)" }}>MCAP {fmtCompact(meta?.marketCap ?? null)}</span>
                </footer>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
