import type { IncomingMessage, ServerResponse } from "node:http";

export class HealthProbe {
  handle(req: IncomingMessage, res: ServerResponse): void {
    if (req.method !== "GET" && req.method !== "HEAD") {
      res.writeHead(405).end();
      return;
    }

    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Content-Length", "2");
    res.writeHead(200);
    if (req.method === "HEAD") {
      res.end();
      return;
    }

    res.end("ok");
  }
}
