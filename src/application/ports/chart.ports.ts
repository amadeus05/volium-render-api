import type { Chart } from "../../domain/chart/chart.ts";

export type RenderedChart = {
  bytes: Uint8Array;
  contentType: "image/png";
};

export interface ChartPainterPort {
  paint(chart: Chart): Promise<RenderedChart>;
}

export interface ChartStoragePort {
  store(id: string, image: RenderedChart): Promise<string>;
}
