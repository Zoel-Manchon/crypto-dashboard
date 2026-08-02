import { HttpPriceGateway } from "./http/http-price-gateway";
import { WebSocketPriceStream } from "./websocket/websocket-price-stream";
import { BinancePriceStream } from "./websocket/binance-price-stream";
import { CompositePriceStream } from "./websocket/composite-price-stream";
import { getLatestPrices } from "../application/use-cases/get-latest-prices";
import { getExtremes } from "../application/use-cases/get-extremes";
import { getSeries } from "../application/use-cases/get-series";
import type { Coin, Currency, Period } from "../domain/price";

// Instantiate adapters ONCE.
const gateway = new HttpPriceGateway();
const stream = new WebSocketPriceStream();
const binance = new BinancePriceStream(() =>
  gateway.coins().then((cs) => cs.map((c) => c.symbol)),
);

// Export use cases pre-bound to the concrete gateway.
// Presentation calls these — it never sees HttpPriceGateway or fetch.
export const api = {
  coins: () => gateway.coins(),
  latestPrices: () => getLatestPrices(gateway),
  extremes: (coin: Coin, currency: Currency, period: Period) =>
    getExtremes(gateway, coin, currency, period),
  series: (coin: Coin, currency: Currency, period: Period) =>
    getSeries(gateway, coin, currency, period),
  ohlc: (coin: Coin, currency: Currency, period: Period) =>
    gateway.ohlc(coin, currency, period),
  exportUrl: (coin: Coin, currency: Currency, period: Period) =>
    gateway.exportUrl(coin, currency, period),
};

// Three adapters behind one PriceStream port.
//
// `priceStream` is what the terminal uses by default: the composite, so USD
// prices tick with every exchange trade while EUR/JPY/RUB keep arriving from
// the backend. The two underlying streams stay exported because the realtime
// chart lets you watch either one on its own — that comparison is half the
// point of having a ports-and-adapters seam here in the first place.
export const backendPriceStream = stream;
export const binancePriceStream = binance;
export const priceStream = new CompositePriceStream([stream, binance]);
