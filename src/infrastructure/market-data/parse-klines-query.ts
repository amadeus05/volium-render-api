import { DEFAULT_RENDER_CANDLES, MAX_RENDER_CANDLES, isChartTimeframe, type ChartTimeframe } from "@volium/contracts";

export type Exchange = "binance" | "bybit";

export type KlinesQuery = {
  exchange: Exchange;
  symbol: string;
  timeframe: ChartTimeframe;
  limit: number;
};

export function parseKlinesQuery(url: URL): KlinesQuery {
  const exchange = url.searchParams.get("exchange")?.trim() ?? "";
  const symbol = url.searchParams.get("symbol")?.trim() ?? "";
  const timeframe = url.searchParams.get("timeframe")?.trim() ?? "";
  const limitRaw = url.searchParams.get("limit")?.trim() ?? "";

  if (exchange !== "binance" && exchange !== "bybit") {
    throw new Error("klines: exchange=binance|bybit");
  }
  if (!/^[A-Z0-9]{2,20}$/.test(symbol)) {
    throw new Error("klines: нужен symbol");
  }
  if (!isChartTimeframe(timeframe)) {
    throw new Error("klines: нужен timeframe");
  }

  const limit = limitRaw === "" ? DEFAULT_RENDER_CANDLES : Number(limitRaw);
  if (!Number.isInteger(limit) || limit < 1) {
    throw new Error("klines: нужен limit");
  }

  return {
    exchange,
    symbol,
    timeframe,
    limit: Math.min(limit, MAX_RENDER_CANDLES),
  };
}
