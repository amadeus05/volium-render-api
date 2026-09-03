import type { CandleDto, ChartTimeframe } from "@volium/contracts";
import type { MarketDataPort } from "./market-data.port.ts";

const BINANCE_KLINES = "https://api.binance.com/api/v3/klines";

type BinanceKline = [number, string, string, string, string, string, ...unknown[]];

export class BinanceMarketData implements MarketDataPort {
  async load(symbol: string, timeframe: ChartTimeframe, limit: number): Promise<CandleDto[]> {
    const url = new URL(BINANCE_KLINES);
    url.searchParams.set("symbol", symbol);
    url.searchParams.set("interval", timeframe);
    url.searchParams.set("limit", String(limit));

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Binance ${response.status}: ${await response.text()}`);
    }

    const rows = (await response.json()) as BinanceKline[];
    if (rows.length === 0) {
      throw new Error("Binance: пустой kline");
    }

    return rows.map((row) => ({
      openTime: row[0],
      open: Number(row[1]),
      high: Number(row[2]),
      low: Number(row[3]),
      close: Number(row[4]),
      volume: Number(row[5]),
    }));
  }
}
