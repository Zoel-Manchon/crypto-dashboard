import type { PriceGateway } from "../ports/price-gateway";
import type { Coin, Currency, Period, PriceExtremes } from "../../domain/price";

export async function getExtremes(
  gateway: PriceGateway,
  coin: Coin,
  currency: Currency,
  period: Period,
): Promise<PriceExtremes | null> {
  return gateway.extremes(coin, currency, period);
}