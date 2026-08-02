import type { PriceGateway } from "../ports/price-gateway";
import type { Coin, Currency, Period, PricePoint } from "../../domain/price";

export async function getSeries(
  gateway: PriceGateway,
  coin: Coin,
  currency: Currency,
  period: Period,
): Promise<PricePoint[]> {
  return gateway.series(coin, currency, period);
}