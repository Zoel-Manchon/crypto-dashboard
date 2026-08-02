import { useCoins } from "../hooks/useCoins";

/** Tiny header island: shows the live tracked-coin count + currencies. */
export default function MarketStatus() {
  const { coins, loading } = useCoins();
  const n = coins.length;
  return (
    <p className="label">
      <span style={{ color: "var(--color-up)" }}>●</span>{" "}
      {loading ? "LOADING" : "LIVE"} · {n > 0 ? `TOP ${n}` : "…"} BY MKT CAP · USD EUR JPY RUB
    </p>
  );
}
