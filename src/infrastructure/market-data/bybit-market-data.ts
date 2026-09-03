import type { CandleDto, ChartTimeframe } from "@volium/contracts";
import type { MarketDataPort } from "./market-data.port.ts";

const BYBIT_KLINE = "https://api.bybit.com/v5/market/kline";

const INTERVAL: Record<ChartTimeframe, string> = {
  "1m": "1",
  "5m": "5",
  "15m": "15",
  "1h": "60",
  "4h": "240",
  "1d": "D",
};

type BybitKline = [string, string, string, string, string, string, string];

type BybitKlineResponse = {
  retCode: number;
  retMsg: string;
  result?: { list?: BybitKline[] };
};

export class BybitMarketData implements MarketDataPort {
  async load(symbol: string, timeframe: ChartTimeframe, limit: number): Promise<CandleDto[]> {
    const url = new URL(BYBIT_KLINE);
    url.searchParams.set("category", "spot");
    url.searchParams.set("symbol", symbol);
    url.searchParams.set("interval", INTERVAL[timeframe]);
    url.searchParams.set("limit", String(limit));

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Bybit ${response.status}: ${await response.text()}`);
    }

    const body = (await response.json()) as BybitKlineResponse;
    if (body.retCode !== 0) {
      throw new Error(`Bybit ${body.retCode}: ${body.retMsg}`);
    }

    const rows = [...(body.result?.list ?? [])].reverse();
    if (rows.length === 0) {
      throw new Error("Bybit: пустой kline");
    }

    return rows.map((row) => ({
      openTime: Number(row[0]),
      open: Number(row[1]),
      high: Number(row[2]),
      low: Number(row[3]),
      close: Number(row[4]),
      volume: Number(row[5]),
    }));
  }
}
