import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Candle } from "../domain/chart/candle.ts";
import { Chart } from "../domain/chart/chart.ts";
import { ChartStyle } from "../domain/chart/chart-style.ts";
import { DetectSessionBoxes } from "../domain/session/detect-session-boxes.ts";
import { SessionHours } from "../domain/session/session-hours.ts";
import { CanvasChartPainter } from "../infrastructure/canvas/canvas-chart.painter.ts";
import { LuxonSessionClock } from "../infrastructure/time/luxon-session.clock.ts";

const barMs = 300_000;
const start = Date.UTC(2026, 7, 31, 10, 0, 0);
const candles: Candle[] = [];
let price = 77_500;

for (let i = 0; i < 288; i += 1) {
  const openTime = start + i * barMs;
  const drift = Math.sin(i / 18) * 80;
  const noise = ((i * 17) % 47) - 23;
  const open = price;
  const close = price + drift * 0.08 + noise * 0.4;
  const high = Math.max(open, close) + 25;
  const low = Math.min(open, close) - 25;
  candles.push(
    Candle.from({
      openTime,
      open,
      high,
      low,
      close,
      volume: 1,
    }),
  );
  price = close;
}

const boxes = new DetectSessionBoxes(new LuxonSessionClock()).detect(
  candles,
  SessionHours.all(),
  "5m",
);
const chart = Chart.compose(
  "smoke",
  "BTCUSDT 5m",
  candles,
  ChartStyle.default(),
  "5m",
  boxes,
);
const image = await new CanvasChartPainter().paint(chart);
const outDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../output/charts");
await mkdir(outDir, { recursive: true });
const outFile = path.join(outDir, "smoke.png");
await writeFile(outFile, image.bytes);
console.log(`boxes=${boxes.length} file=${outFile}`);
