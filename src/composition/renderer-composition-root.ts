import path from "node:path";
import { fileURLToPath } from "node:url";
import { CanvasChartPainter } from "../infrastructure/canvas/canvas-chart.painter.ts";
import { LocalChartStorage } from "../infrastructure/storage/local-chart.storage.ts";
import { LuxonSessionClock } from "../infrastructure/time/luxon-session.clock.ts";
import { DetectLiquiditySweeps } from "../domain/session/detect-liquidity-sweeps.ts";
import { DetectSessionBoxes } from "../domain/session/detect-session-boxes.ts";
import { SessionEvents } from "../domain/session/session-events.ts";
import { RenderChartUseCase } from "../application/use-cases/render-chart.use-case.ts";
import { ListSessionEventsUseCase } from "../application/use-cases/list-session-events.use-case.ts";
import { RenderChartController } from "../presentation/http/render-chart.controller.ts";
import { EventsController } from "../presentation/http/events.controller.ts";
import { KlinesController } from "../presentation/http/klines.controller.ts";
import { klineFeed } from "../infrastructure/market-data/kline-feed.ts";

const here = path.dirname(fileURLToPath(import.meta.url));

export class RendererCompositionRoot {
  readonly controller: RenderChartController;
  readonly klines: KlinesController;
  readonly events: EventsController;
  readonly chartsDir: string;

  constructor(secret: string, publicBaseUrl: string) {
    this.chartsDir = path.resolve(here, "../../output/charts");
    const clock = new LuxonSessionClock();
    const useCase = new RenderChartUseCase(
      new CanvasChartPainter(),
      new LocalChartStorage(this.chartsDir, publicBaseUrl),
      new DetectSessionBoxes(clock),
      new DetectLiquiditySweeps(),
    );

    this.controller = new RenderChartController(useCase, secret);
    this.klines = new KlinesController(secret);
    this.events = new EventsController(
      secret,
      new ListSessionEventsUseCase(new SessionEvents(clock), useCase, (exchange, symbol, timeframe, limit) =>
        klineFeed(exchange).load(symbol, timeframe, limit),
      ),
    );
  }
}
