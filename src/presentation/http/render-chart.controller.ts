import type { IncomingMessage, ServerResponse } from "node:http";
import type { RenderChartUseCase } from "../../application/use-cases/render-chart.use-case.ts";
import { parseRenderChartRequest } from "../../application/use-cases/parse-render-chart-request.ts";

const MAX_BODY_BYTES = 1_000_000;

export class RenderChartController {
  constructor(
    private readonly useCase: RenderChartUseCase,
    private readonly secret: string,
  ) {}

  async handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    if (req.headers.authorization !== `Bearer ${this.secret}`) {
      res.writeHead(403).end("forbidden");
      return;
    }

    const body = await readBody(req, MAX_BODY_BYTES);
    if (body == null) {
      res.writeHead(413).end("payload too large");
      return;
    }

    const parsed = parseRenderChartRequest(body);
    if (!parsed.isOk) {
      res.writeHead(parsed.error.status).end(parsed.error.message);
      return;
    }

    const result = await this.useCase.execute(parsed.value);
    res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify(result));
  }
}

function readBody(req: IncomingMessage, maxBytes: number): Promise<string | null> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    let settled = false;

    const finish = (value: string | null): void => {
      if (settled) {
        return;
      }

      settled = true;
      resolve(value);
    };

    req.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > maxBytes) {
        req.destroy();
        finish(null);
        return;
      }

      chunks.push(chunk);
    });
    req.on("end", () => finish(Buffer.concat(chunks).toString("utf8")));
    req.on("error", (error: Error) => {
      if (settled) {
        return;
      }

      reject(error);
    });
  });
}
