import type { PriceGateway } from "../ports/price-gateway";
import type { Price } from "../../domain/price";

export async function getLatestPrices(gateway: PriceGateway): Promise<Price[]> {
  return gateway.latestPrices();
}