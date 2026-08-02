import type { PriceGateway } from "../../application/ports/price-gateway";
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
import { API_BASE_URL } from "../config";
import {
  toPrice,
  toExtremes,
  toPricePoint,
  toCoinMeta,
  toCandle,
  type PriceDto,
  type ExtremesDto,
  type PricePointDto,
  type CoinMetaDto,
  type CandleDto,
} from "../dto/price-dto";

export class HttpPriceGateway implements PriceGateway {
  async coins(): Promise<CoinMeta[]> {
    const res = await fetch(`${API_BASE_URL}/api/coins`);
    if (!res.ok) throw new Error(`coins failed: ${res.status}`);
    const dtos: CoinMetaDto[] = await res.json();
    return dtos.map(toCoinMeta);
  }

  async latestPrices(): Promise<Price[]> {
    const res = await fetch(`${API_BASE_URL}/api/prices/latest`);
    if (!res.ok) throw new Error(`latestPrices failed: ${res.status}`);
    const dtos: PriceDto[] = await res.json();
    return dtos.map(toPrice);
  }

  async extremes(coin: Coin, currency: Currency, period: Period): Promise<PriceExtremes | null> {
    const res = await fetch(
      `${API_BASE_URL}/api/prices/extremes?coin=${coin}&currency=${currency}&period=${period}`,
    );
    if (!res.ok) throw new Error(`extremes failed: ${res.status}`);
    const dto: ExtremesDto | null = await res.json();
    return dto ? toExtremes(dto) : null;
  }

  async series(coin: Coin, currency: Currency, period: Period): Promise<PricePoint[]> {
    const res = await fetch(
      `${API_BASE_URL}/api/prices/series?coin=${coin}&currency=${currency}&period=${period}`,
    );
    if (!res.ok) throw new Error(`series failed: ${res.status}`);
    const dtos: PricePointDto[] = await res.json();
    return dtos.map(toPricePoint);
  }

  async ohlc(coin: Coin, currency: Currency, period: Period): Promise<Candle[]> {
    const res = await fetch(
      `${API_BASE_URL}/api/prices/ohlc?coin=${coin}&currency=${currency}&period=${period}`,
    );
    if (!res.ok) throw new Error(`ohlc failed: ${res.status}`);
    const dtos: CandleDto[] = await res.json();
    return dtos.map(toCandle);
  }

  exportUrl(coin: Coin, currency: Currency, period: Period): string {
    return `${API_BASE_URL}/api/prices/export?coin=${coin}&currency=${currency}&period=${period}`;
  }
}
