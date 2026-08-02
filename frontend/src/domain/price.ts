// Mirrors the Rust domain. Pure types — no framework, no fetch, no React.
// Coins are no longer a fixed union: the set is decided at runtime by the
// backend (top-N by market cap), fetched via GET /api/coins.

export type Coin = string; // an upper-case ticker symbol, e.g. "BTC"
export type Currency = "USD" | "EUR" | "JPY" | "RUB";
export type Period = "day" | "week" | "month";

export const ALL_CURRENCIES: readonly Currency[] = ["USD", "EUR", "JPY", "RUB"];
export const ALL_PERIODS: readonly Period[] = ["day", "week", "month"];

/** Runtime description of a tracked coin (from /api/coins, enriched w/ color). */
export interface CoinMeta {
  readonly symbol: Coin;
  readonly name: string;
  readonly id: string;
  readonly image: string | null;
  readonly rank: number | null;
  readonly color: string;
  readonly marketCap: number | null;
  readonly volume24h: number | null;
  readonly change24h: number | null;
  readonly circulatingSupply: number | null;
  /** 7-day price sparkline (USD), oldest -> newest. */
  readonly sparkline7d: number[] | null;
}

/** One OHLC candle. */
export interface Candle {
  readonly t: Date;
  readonly o: number;
  readonly h: number;
  readonly l: number;
  readonly c: number;
}

// Brand colors for well-known tickers; everything else gets a stable generated
// hue. This means we no longer hand-maintain a color per coin.
const BRAND_COLORS: Record<string, string> = {
  BTC: "#f7931a", ETH: "#627eea", SOL: "#14f195", LTC: "#345d9d",
  BNB: "#f3ba2f", XRP: "#9aa4b2", ADA: "#3cc8c8", DOGE: "#c2a633",
  AVAX: "#e84142", DOT: "#e6007a", LINK: "#2a5ada", BCH: "#8dc351",
  USDT: "#26a17b", USDC: "#2775ca", TRX: "#ef0027", TON: "#0098ea",
  MATIC: "#8247e5", SHIB: "#f00500", NEAR: "#00ec97", UNI: "#ff007a",
  ICP: "#3b00b9", APT: "#06f5d2", XLM: "#14b6e7", ATOM: "#2e3148",
  ETC: "#3ab83a", FIL: "#0090ff", HBAR: "#222222", ARB: "#28a0f0",
  OP: "#ff0420", SUI: "#4da2ff", PEPE: "#3d8c40", XMR: "#ff6600",
};

const BRAND_NAMES: Record<string, string> = {
  BTC: "BITCOIN", ETH: "ETHEREUM", SOL: "SOLANA", LTC: "LITECOIN",
  BNB: "BNB", XRP: "XRP", ADA: "CARDANO", DOGE: "DOGECOIN",
  AVAX: "AVALANCHE", DOT: "POLKADOT", LINK: "CHAINLINK", BCH: "BITCOIN CASH",
};

/** Deterministic color for any ticker — brand color if known, else a stable hue. */
export function colorForSymbol(symbol: string): string {
  const up = symbol.toUpperCase();
  if (BRAND_COLORS[up]) return BRAND_COLORS[up];
  let h = 2166136261;
  for (let i = 0; i < up.length; i++) {
    h ^= up.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const hue = (h >>> 0) % 360;
  return `hsl(${hue} 68% 58%)`;
}

/** Display name for a ticker — a known brand name, else the symbol itself. */
export function nameForSymbol(symbol: string): string {
  return BRAND_NAMES[symbol.toUpperCase()] ?? symbol.toUpperCase();
}

/** A single price snapshot — one coin, one currency, one moment. */
export interface Price {
  readonly coin: Coin;
  readonly currency: Currency;
  /** Exact decimal value, kept as string to preserve precision (matches backend). */
  readonly value: string;
  readonly observedAt: Date;
  /** Provider-reported 24h percentage change when available. */
  readonly change24h: number | null;
}

/** Highest & lowest over a period — powers the Highest/Lowest tabs. */
export interface PriceExtremes {
  readonly coin: Coin;
  readonly currency: Currency;
  readonly period: Period;
  readonly highest: string;
  readonly lowest: string;
}

/** One point in a chart series. */
export interface PricePoint {
  readonly value: string;
  readonly observedAt: Date;
}
