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
import { colorForSymbol } from "../../domain/price";

// These match the Rust DTOs exactly (the JSON the backend sends).
export interface PriceDto {
  coin: string;
  currency: string;
  value: string;
  observed_at: string;
  change_24h?: number | null;
}
export interface ExtremesDto {
  coin: string;
  currency: string;
  period: string;
  highest: string;
  lowest: string;
}
export interface PricePointDto {
  value: string;
  observed_at: string;
}
export interface CoinMetaDto {
  symbol: string;
  name: string;
  id: string;
  image?: string | null;
  rank?: number | null;
  market_cap?: number | null;
  volume_24h?: number | null;
  change_24h?: number | null;
  circulating_supply?: number | null;
  sparkline_7d?: number[] | null;
}

export interface CandleDto {
  t: string;
  o: string;
  h: string;
  l: string;
  c: string;
}

// Mappers: backend JSON → domain types. One place to fix if the API changes.
export function toPrice(dto: PriceDto): Price {
  return {
    coin: dto.coin as Coin,
    currency: dto.currency as Currency,
    value: dto.value,
    observedAt: new Date(dto.observed_at),
    change24h: dto.change_24h ?? null,
  };
}

export function toExtremes(dto: ExtremesDto): PriceExtremes {
  return {
    coin: dto.coin as Coin,
    currency: dto.currency as Currency,
    period: dto.period as Period,
    highest: dto.highest,
    lowest: dto.lowest,
  };
}

export function toPricePoint(dto: PricePointDto): PricePoint {
  return {
    value: dto.value,
    observedAt: new Date(dto.observed_at),
  };
}

export function toCoinMeta(dto: CoinMetaDto): CoinMeta {
  const symbol = dto.symbol.toUpperCase();
  return {
    symbol,
    name: dto.name,
    id: dto.id,
    image: dto.image ?? null,
    rank: dto.rank ?? null,
    color: colorForSymbol(symbol),
    marketCap: dto.market_cap ?? null,
    volume24h: dto.volume_24h ?? null,
    change24h: dto.change_24h ?? null,
    circulatingSupply: dto.circulating_supply ?? null,
    sparkline7d: dto.sparkline_7d ?? null,
  };
}

export function toCandle(dto: CandleDto): Candle {
  return {
    t: new Date(dto.t),
    o: Number(dto.o),
    h: Number(dto.h),
    l: Number(dto.l),
    c: Number(dto.c),
  };
}
