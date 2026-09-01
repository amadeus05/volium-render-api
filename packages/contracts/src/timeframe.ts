export type ChartTimeframe = "1m" | "5m" | "15m" | "1h" | "4h" | "1d";

export const INTRADAY_TIMEFRAMES: readonly ChartTimeframe[] = ["1m", "5m", "15m", "1h", "4h"];

export const TIMEFRAME_MS: Record<ChartTimeframe, number> = {
  "1m": 60_000,
  "5m": 300_000,
  "15m": 900_000,
  "1h": 3_600_000,
  "4h": 14_400_000,
  "1d": 86_400_000,
};

export function isChartTimeframe(value: string): value is ChartTimeframe {
  return Object.hasOwn(TIMEFRAME_MS, value);
}

export function isIntraday(timeframe: ChartTimeframe): boolean {
  return INTRADAY_TIMEFRAMES.includes(timeframe);
}
