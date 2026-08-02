import type {
  Candle,
  Coin,
  CoinMeta,
  Currency,
  Period,
  Price,
  PriceExtremes,
  PricePoint,
} from "../../domain/price";

/** Port: how the app reads prices. Infrastructure implements this. */
export interface PriceGateway {
  /** The coins the backend currently tracks (top-N by market cap). */
  coins(): Promise<CoinMeta[]>;
  latestPrices(): Promise<Price[]>;
  extremes(coin: Coin, currency: Currency, period: Period): Promise<PriceExtremes | null>;
  series(coin: Coin, currency: Currency, period: Period): Promise<PricePoint[]>;
  ohlc(coin: Coin, currency: Currency, period: Period): Promise<Candle[]>;
  /** Builds the CSV export URL — the browser navigates to it for download. */
  exportUrl(coin: Coin, currency: Currency, period: Period): string;
}
