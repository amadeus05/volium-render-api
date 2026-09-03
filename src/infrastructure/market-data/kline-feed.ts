import { BinanceMarketData } from "./binance-market-data.ts";
import { BybitMarketData } from "./bybit-market-data.ts";
import type { Exchange } from "./parse-klines-query.ts";
import type { MarketDataPort } from "./market-data.port.ts";

export function klineFeed(exchange: Exchange): MarketDataPort {
  if (exchange === "binance") {
    return new BinanceMarketData();
  }
  return new BybitMarketData();
}
