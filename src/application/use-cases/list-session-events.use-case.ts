import type { CandleDto, SessionEventsResponse } from "@volium/contracts";
import type { SessionNotices } from "../../domain/session/session-notices.ts";
import type { RenderChartUseCase } from "./render-chart.use-case.ts";
import type { EventsQuery } from "../../infrastructure/market-data/parse-events-query.ts";

export type LoadKlines = (
  exchange: EventsQuery["exchange"],
  symbol: string,
  timeframe: EventsQuery["timeframe"],
  limit: number,
) => Promise<CandleDto[]>;

export class ListSessionEventsUseCase {
  constructor(
    private readonly notices: SessionNotices,
    private readonly render: Pick<RenderChartUseCase, "execute">,
    private readonly loadKlines: LoadKlines,
  ) {}

  async execute(query: EventsQuery): Promise<SessionEventsResponse> {
    const candles = await this.loadKlines(query.exchange, query.symbol, query.timeframe, query.limit);
    const notices = this.notices.list(query.symbol, candles, query.now, query.timeframe);
    const imageUrl = notices.some((notice) => notice.kind === "liquidity")
      ? await this.sweepChart(query.symbol, query.timeframe, candles)
      : null;

    return {
      exchange: query.exchange,
      symbol: query.symbol,
      timeframe: query.timeframe,
      notices,
      imageUrl,
    };
  }

  private async sweepChart(
    symbol: string,
    timeframe: EventsQuery["timeframe"],
    candles: CandleDto[],
  ): Promise<string | null> {
    try {
      const chart = await this.render.execute({
        requestId: crypto.randomUUID(),
        symbol,
        timeframe,
        candles,
        title: `${symbol} ${timeframe.toUpperCase()}`,
        layers: { sessions: true, sweeps: true },
      });
      return chart.imageUrl;
    } catch {
      return null;
    }
  }
}
