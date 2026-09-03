import type { IncomingMessage, ServerResponse } from "node:http";
import type { SessionNotices } from "../../domain/session/session-notices.ts";
import { klineFeed } from "../../infrastructure/market-data/kline-feed.ts";
import { parseEventsQuery } from "../../infrastructure/market-data/parse-events-query.ts";

export class EventsController {
  constructor(
    private readonly secret: string,
    private readonly notices: SessionNotices,
  ) {}

  async handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    if (req.headers.authorization !== `Bearer ${this.secret}`) {
      res.writeHead(403).end("forbidden");
      return;
    }

    try {
      const query = parseEventsQuery(new URL(req.url ?? "/", "http://local"));
      const candles = await klineFeed(query.exchange).load(query.symbol, query.timeframe, query.limit);
      const notices = this.notices.list(query.symbol, candles, query.now, query.timeframe);
      res.writeHead(200, { "content-type": "application/json" }).end(
        JSON.stringify({
          exchange: query.exchange,
          symbol: query.symbol,
          timeframe: query.timeframe,
          candles,
          notices,
        }),
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "events failed";
      const status = message.startsWith("klines:") || message.startsWith("events:") ? 400 : 502;
      res.writeHead(status).end(message);
    }
  }
}
