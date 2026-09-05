import type { ChartTimeframe } from "./timeframe.ts";

export type SessionEventKind = "open" | "close" | "liquidity";

export type SessionEventDto = {
  id: string;
  text: string;
  kind: SessionEventKind;
};

export type SessionEventsResponse = {
  exchange: string;
  symbol: string;
  timeframe: ChartTimeframe;
  events: SessionEventDto[];
  imageUrl: string | null;
};
