import type { ChartTimeframe } from "./timeframe.ts";

export type CandleDto = {
  openTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export type RenderChartRequest = {
  requestId: string;
  symbol: string;
  timeframe: ChartTimeframe;
  candles: CandleDto[];
  title?: string;
};

export type RenderChartResponse = {
  requestId: string;
  imageUrl: string;
  contentType: "image/png";
};
