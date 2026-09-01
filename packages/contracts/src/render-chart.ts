import type { ChartTimeframe } from "./timeframe.ts";

export const MAX_RENDER_CANDLES = 400;
export const DEFAULT_RENDER_CANDLES = 144;

export type CandleDto = {
  openTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export type ChartLayers = {
  sessions?: boolean;
  sweeps?: boolean;
};

export type RenderChartRequest = {
  requestId: string;
  symbol: string;
  timeframe: ChartTimeframe;
  candles: CandleDto[];
  title?: string;
  layers?: ChartLayers;
};

export type RenderChartResponse = {
  requestId: string;
  imageUrl: string;
  contentType: "image/png";
};
