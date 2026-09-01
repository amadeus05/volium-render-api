import type { RenderChartRequest, RenderChartResponse } from "@volium/contracts";
import { Chart } from "../../domain/chart/chart.ts";
import { Candle } from "../../domain/chart/candle.ts";
import { ChartStyle } from "../../domain/chart/chart-style.ts";
import { DetectLiquiditySweeps } from "../../domain/session/detect-liquidity-sweeps.ts";
import { DetectSessionBoxes } from "../../domain/session/detect-session-boxes.ts";
import { VoliumSessions } from "../../domain/session/volium-sessions.ts";
import { VoliumSweeps } from "../../domain/session/volium-sweeps.ts";
import type { ChartPainterPort, ChartStoragePort } from "../ports/chart.ports.ts";

export class RenderChartUseCase {
  constructor(
    private readonly painter: ChartPainterPort,
    private readonly storage: ChartStoragePort,
    private readonly sessions: DetectSessionBoxes,
    private readonly sweeps: DetectLiquiditySweeps,
  ) {}

  async execute(request: RenderChartRequest): Promise<RenderChartResponse> {
    const candles = request.candles.map((candle) => Candle.from(candle));
    const boxes = this.sessions.detect(candles, VoliumSessions.all(), request.timeframe);
    const sweeps = this.sweeps.detect(candles, boxes, VoliumSweeps.default());
    const chart = Chart.compose(
      request.requestId,
      request.title ?? request.symbol,
      candles,
      ChartStyle.default(),
      request.timeframe,
      boxes,
      sweeps,
    );

    const image = await this.painter.paint(chart);
    const imageUrl = await this.storage.store(request.requestId, image);

    return {
      requestId: request.requestId,
      imageUrl,
      contentType: "image/png",
    };
  }
}
