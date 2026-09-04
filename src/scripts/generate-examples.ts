import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { ChartTimeframe } from "@volium/contracts";
import { Candle } from "../domain/chart/candle.ts";
import { Chart } from "../domain/chart/chart.ts";
import { ChartStyle } from "../domain/chart/chart-style.ts";
import { DetectLiquiditySweeps } from "../domain/session/detect-liquidity-sweeps.ts";
import { DetectSessionBoxes } from "../domain/session/detect-session-boxes.ts";
import { SessionHours } from "../domain/session/session-hours.ts";
import { SweepRules } from "../domain/session/sweep-rules.ts";
import { CanvasChartPainter } from "../infrastructure/canvas/canvas-chart.painter.ts";
import { loadCandlesFromCsv } from "../infrastructure/market-data/load-candles-from-csv.ts";
import { LuxonSessionClock } from "../infrastructure/time/luxon-session.clock.ts";

const here = path.dirname(fileURLToPath(import.meta.url));
const csvPath = path.resolve(here, "../../data/btcusdt-5m.csv");
const outDir = path.resolve(here, "../../output/charts");
const painter = new CanvasChartPainter();
const detector = new DetectSessionBoxes(new LuxonSessionClock());
const sweeps = new DetectLiquiditySweeps();

function sliceLast(candles: Candle[], count: number): Candle[] {
  return candles.slice(Math.max(0, candles.length - count));
}

function aggregateHour(candles: Candle[]): Candle[] {
  const groups = new Map<number, Candle[]>();
  for (const candle of candles) {
    const hourOpen = candle.openTime - (candle.openTime % 3_600_000);
    const bucket = groups.get(hourOpen) ?? [];
    bucket.push(candle);
    groups.set(hourOpen, bucket);
  }

  return [...groups.entries()]
    .sort((a, b) => a[0] - b[0])
    .flatMap(([openTime, bucket]) => {
      const first = bucket[0];
      const last = bucket[bucket.length - 1];
      if (first == null || last == null) {
        return [];
      }

      return [
        Candle.from({
          openTime,
          open: first.open,
          high: Math.max(...bucket.map((item) => item.high)),
          low: Math.min(...bucket.map((item) => item.low)),
          close: last.close,
          volume: bucket.reduce((sum, item) => sum + item.volume, 0),
        }),
      ];
    });
}

async function render(
  id: string,
  title: string,
  candles: Candle[],
  timeframe: ChartTimeframe,
): Promise<void> {
  const boxes = detector.detect(candles, SessionHours.all(), timeframe);
  const liquidity = sweeps.detect(candles, boxes, SweepRules.default());
  const chart = Chart.compose(id, title, candles, ChartStyle.default(), timeframe, boxes, liquidity);
  const image = await painter.paint(chart);
  const file = path.join(outDir, `${id}.png`);
  await writeFile(file, image.bytes);
  console.log(`${id}: candles=${candles.length} boxes=${boxes.length} sweeps=${liquidity.length} → ${file}`);
}

const all = await loadCandlesFromCsv(csvPath);
if (all.length === 0) {
  throw new Error(`CSV пустой: ${csvPath}`);
}

await mkdir(outDir, { recursive: true });
await render("btcusdt-5m-12h", "BTCUSDT 5m · 12h", sliceLast(all, 144), "5m");
await render("btcusdt-5m-24h", "BTCUSDT 5m · 24h", sliceLast(all, 288), "5m");
await render("btcusdt-1h-5d", "BTCUSDT 1h · 5d", sliceLast(aggregateHour(all), 120), "1h");
