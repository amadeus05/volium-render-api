import type { IncomingMessage, ServerResponse } from "node:http";
import { klineFeed } from "../../infrastructure/market-data/kline-feed.ts";
import { parseKlinesQuery } from "../../infrastructure/market-data/parse-klines-query.ts";

export class KlinesController {
  constructor(private readonly secret: string) {}

  async handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    if (req.headers.authorization !== `Bearer ${this.secret}`) {
      res.writeHead(403).end("forbidden");
      return;
    }

    try {
      const query = parseKlinesQuery(new URL(req.url ?? "/", "http://local"));
      const candles = await klineFeed(query.exchange).load(query.symbol, query.timeframe, query.limit);
      res.writeHead(200, { "content-type": "application/json" }).end(
        JSON.stringify({
          exchange: query.exchange,
          symbol: query.symbol,
          timeframe: query.timeframe,
          candles,
        }),
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "klines failed";
      const status = message.startsWith("klines:") ? 400 : 502;
      res.writeHead(status).end(message);
    }
  }
}
