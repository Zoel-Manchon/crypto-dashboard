import { useEffect, useMemo, useRef, useState } from "react";
import { useLivePrices } from "../hooks/useLivePrices";
import { useCoins } from "../hooks/useCoins";
import { useLocalState } from "../hooks/useLocalState";
import CoinIcon from "./CoinIcon";
import { ALL_CURRENCIES, type Currency } from "../../domain/price";

const CURRENCY_SYMBOL: Record<Currency, string> = { USD: "$", EUR: "€", JPY: "¥", RUB: "₽" };

interface Alert {
  id: string;
  coin: string;
  currency: Currency;
  direction: "above" | "below";
  threshold: number;
  triggeredAt: number | null;
}

function fmt(n: number, c: Currency) {
  return CURRENCY_SYMBOL[c] + n.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

export default function PriceAlerts() {
  const { prices, live } = useLivePrices();
  const { coins } = useCoins();
  const [alerts, setAlerts] = useLocalState<Alert[]>("cw.alerts", []);

  const [coin, setCoin] = useState("");
  const [currency, setCurrency] = useState<Currency>("USD");
  const [direction, setDirection] = useState<"above" | "below">("above");
  const [threshold, setThreshold] = useState("");
  const [perm, setPerm] = useState<NotificationPermission>("default");

  useEffect(() => {
    if (!coin && coins.length > 0) setCoin(coins[0].symbol);
  }, [coins, coin]);

  useEffect(() => {
    if (typeof Notification !== "undefined") setPerm(Notification.permission);
  }, []);

  // Current price lookup from the live feed.
  const priceOf = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of prices) m.set(`${p.coin}:${p.currency}`, Number(p.value));
    return m;
  }, [prices]);

  // Evaluate on every live tick; fire once per crossing.
  const firedRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (alerts.length === 0) return;
    let changed = false;
    const next = alerts.map((a) => {
      const cur = priceOf.get(`${a.coin}:${a.currency}`);
      if (cur === undefined) return a;
      const hit = a.direction === "above" ? cur >= a.threshold : cur <= a.threshold;
      if (hit && a.triggeredAt === null) {
        changed = true;
        if (!firedRef.current.has(a.id)) {
          firedRef.current.add(a.id);
          notify(`${a.coin} ${a.direction} ${fmt(a.threshold, a.currency)}`, `Now ${fmt(cur, a.currency)}`);
        }
        return { ...a, triggeredAt: Date.now() };
      }
      return a;
    });
    if (changed) setAlerts(next);
    // Re-run on every price tick AND whenever the alert set changes, so a
    // freshly-added alert that's already true fires immediately instead of
    // waiting up to POLL_INTERVAL_SECONDS for the next tick.
  }, [priceOf, alerts]);

  function notify(title: string, body: string) {
    try {
      if (typeof Notification !== "undefined" && Notification.permission === "granted") {
        new Notification(`⚠ ${title}`, { body });
      }
    } catch {
      /* notifications unavailable */
    }
  }

  async function requestPerm() {
    if (typeof Notification === "undefined") return;
    const p = await Notification.requestPermission();
    setPerm(p);
  }

  function addAlert() {
    const t = Number(threshold);
    if (!coin || Number.isNaN(t) || t <= 0) return;
    const id = (crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`);
    setAlerts((prev) => [...prev, { id, coin, currency, direction, threshold: t, triggeredAt: null }]);
    setThreshold("");
  }

  function remove(id: string) {
    firedRef.current.delete(id);
    setAlerts((prev) => prev.filter((a) => a.id !== id));
  }

  function rearm(id: string) {
    firedRef.current.delete(id);
    setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, triggeredAt: null } : a)));
  }

  const inputStyle = { backgroundColor: "var(--bg-row)", color: "var(--text)", border: "1px solid var(--grid-strong)" };

  return (
    <div className="border" style={{ borderColor: "var(--grid-strong)", backgroundColor: "var(--bg-panel)" }}>
      <div className="flex items-center justify-between border-b px-4 py-3" style={{ borderColor: "var(--grid)" }}>
        <div className="flex items-center gap-3">
          <span className="label">PRICE ALERTS</span>
          <span className="label" style={{ color: live ? "var(--color-up)" : "var(--text-faint)" }}>{live ? "● ARMED" : "○ WAITING"}</span>
        </div>
        {perm !== "granted" && (
          <button onClick={requestPerm} className="px-3 py-1.5 text-xs font-bold uppercase tracking-wider" style={{ backgroundColor: "var(--color-accent)", color: "#050506" }}>
            ENABLE NOTIFICATIONS
          </button>
        )}
      </div>

      {/* New alert row */}
      <div className="flex flex-wrap items-end gap-2 border-b px-4 py-3" style={{ borderColor: "var(--grid)" }}>
        <select value={coin} onChange={(e) => setCoin(e.target.value)} className="px-3 py-1.5 text-sm font-bold" style={inputStyle}>
          {coins.map((c) => <option key={c.symbol} value={c.symbol}>{c.symbol}</option>)}
        </select>
        <select value={currency} onChange={(e) => setCurrency(e.target.value as Currency)} className="px-3 py-1.5 text-sm font-bold" style={inputStyle}>
          {ALL_CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <div className="flex gap-px" style={{ backgroundColor: "var(--grid)" }}>
          {(["above", "below"] as const).map((d) => (
            <button key={d} onClick={() => setDirection(d)} className="px-3 py-1.5 text-xs font-bold uppercase tracking-wider"
              style={{ backgroundColor: direction === d ? "var(--text)" : "var(--bg-row)", color: direction === d ? "var(--bg)" : "var(--text-dim)" }}>
              {d === "above" ? "▲ ABOVE" : "▼ BELOW"}
            </button>
          ))}
        </div>
        <input value={threshold} onChange={(e) => setThreshold(e.target.value)} inputMode="decimal" placeholder="PRICE"
          onKeyDown={(e) => e.key === "Enter" && addAlert()}
          className="w-28 px-3 py-1.5 text-sm font-bold outline-none" style={inputStyle} />
        <button onClick={addAlert} className="px-4 py-1.5 text-xs font-bold uppercase tracking-wider" style={{ backgroundColor: "var(--color-accent)", color: "#050506" }}>+ ADD</button>
      </div>

      {/* Alert list */}
      {alerts.length === 0 ? (
        <p className="label px-4 py-6">NO ALERTS — fires on the live stream when a coin crosses your price.</p>
      ) : (
        <div>
          {alerts.map((a) => {
            const cur = priceOf.get(`${a.coin}:${a.currency}`);
            const triggered = a.triggeredAt !== null;
            return (
              <div key={a.id} className="grid items-center gap-3 px-4 py-2.5"
                style={{ gridTemplateColumns: "150px 1fr 120px 70px", borderTop: "1px solid var(--grid)", backgroundColor: triggered ? "color-mix(in srgb, var(--color-accent) 12%, transparent)" : "transparent" }}>
                <div className="flex items-center gap-2">
                  <CoinIcon symbol={a.coin} size={16} />
                  <span className="text-sm font-bold">{a.coin}</span>
                  <span className="label" style={{ color: "var(--text-faint)" }}>{a.currency}</span>
                </div>
                <span className="text-sm font-bold" style={{ color: a.direction === "above" ? "var(--color-up)" : "var(--color-down)" }}>
                  {a.direction === "above" ? "▲ ≥" : "▼ ≤"} {fmt(a.threshold, a.currency)}
                </span>
                <span className="tabular text-sm" style={{ color: "var(--text-dim)" }}>
                  {cur !== undefined ? `now ${fmt(cur, a.currency)}` : "—"}
                </span>
                <div className="flex items-center justify-end gap-2">
                  {triggered ? (
                    <button onClick={() => rearm(a.id)} className="label" style={{ color: "var(--color-accent)" }} title="Re-arm">⟳ HIT</button>
                  ) : null}
                  <button onClick={() => remove(a.id)} className="label" style={{ color: "var(--text-faint)" }} title="Delete">✕</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
