import type { IncomingMessage, ServerResponse } from "node:http";
import type { ListSessionEventsUseCase } from "../../application/use-cases/list-session-events.use-case.ts";
import { parseEventsQuery } from "../../infrastructure/market-data/parse-events-query.ts";

export class EventsController {
  constructor(
    private readonly secret: string,
    private readonly listEvents: ListSessionEventsUseCase,
  ) {}

  async handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    if (req.headers.authorization !== `Bearer ${this.secret}`) {
      res.writeHead(403).end("forbidden");
      return;
    }

    try {
      const payload = await this.listEvents.execute(parseEventsQuery(new URL(req.url ?? "/", "http://local")));
      res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify(payload));
    } catch (error) {
      const message = error instanceof Error ? error.message : "events failed";
      const status = message.startsWith("klines:") || message.startsWith("events:") ? 400 : 502;
      res.writeHead(status).end(message);
    }
  }
}
