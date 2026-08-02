import { useState } from "react";
import { type CoinMeta, colorForSymbol } from "../../domain/price";

/** Coin logo from the provider, with a colored-initial fallback. */
export default function CoinIcon({
  meta,
  symbol,
  size = 18,
}: {
  meta?: CoinMeta;
  symbol: string;
  size?: number;
}) {
  const [failed, setFailed] = useState(false);
  const img = meta?.image;

  if (img && !failed) {
    return (
      <img
        src={img}
        alt={symbol}
        width={size}
        height={size}
        loading="lazy"
        onError={() => setFailed(true)}
        style={{ borderRadius: "50%", display: "block", flexShrink: 0 }}
      />
    );
  }

  const color = meta?.color ?? colorForSymbol(symbol);
  return (
    <span
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        backgroundColor: color,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: Math.round(size * 0.48),
        fontWeight: 800,
        color: "#08080a",
        flexShrink: 0,
      }}
    >
      {symbol.charAt(0)}
    </span>
  );
}
