import type { CandleDto, ChartTimeframe } from "@volium/contracts";

export interface MarketDataPort {
  load(symbol: string, timeframe: ChartTimeframe, limit: number): Promise<CandleDto[]>;
}
