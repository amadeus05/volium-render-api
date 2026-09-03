import type { ChartTimeframe } from "./timeframe.ts";

export type SessionNoticeKind = "open" | "close" | "liquidity";

export type SessionNoticeDto = {
  id: string;
  text: string;
  kind: SessionNoticeKind;
};

export type SessionEventsResponse = {
  exchange: string;
  symbol: string;
  timeframe: ChartTimeframe;
  notices: SessionNoticeDto[];
  imageUrl: string | null;
};
