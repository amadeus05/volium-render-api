import type { IncomingMessage, ServerResponse } from "node:http";
import type { RenderChartRequest } from "@volium/contracts";
import type { RenderChartUseCase } from "../../application/use-cases/render-chart.use-case.ts";

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

    const body = await readBody(req);
    const request = JSON.parse(body) as RenderChartRequest;
    const result = await this.useCase.execute(request);

    res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify(result));
  }
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}
