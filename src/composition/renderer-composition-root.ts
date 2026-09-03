import path from "node:path";
import { fileURLToPath } from "node:url";
import { CanvasChartPainter } from "../infrastructure/canvas/canvas-chart.painter.ts";
import { LocalChartStorage } from "../infrastructure/storage/local-chart.storage.ts";
import { LuxonSessionClock } from "../infrastructure/time/luxon-session.clock.ts";
import { DetectLiquiditySweeps } from "../domain/session/detect-liquidity-sweeps.ts";
import { DetectSessionBoxes } from "../domain/session/detect-session-boxes.ts";
import { RenderChartUseCase } from "../application/use-cases/render-chart.use-case.ts";
import { RenderChartController } from "../presentation/http/render-chart.controller.ts";
import { KlinesController } from "../presentation/http/klines.controller.ts";

const here = path.dirname(fileURLToPath(import.meta.url));

export class RendererCompositionRoot {
  readonly controller: RenderChartController;
  readonly klines: KlinesController;
  readonly chartsDir: string;

  constructor(secret: string, publicBaseUrl: string) {
    this.chartsDir = path.resolve(here, "../../output/charts");
    const useCase = new RenderChartUseCase(
      new CanvasChartPainter(),
      new LocalChartStorage(this.chartsDir, publicBaseUrl),
      new DetectSessionBoxes(new LuxonSessionClock()),
      new DetectLiquiditySweeps(),
    );

    this.controller = new RenderChartController(useCase, secret);
    this.klines = new KlinesController(secret);
  }
}
