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
import { LuxonSessionClock } from "../infrastructure/time/luxon-session.clock.ts";

const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(here, "../../output/charts");
const painter = new CanvasChartPainter();
const detector = new DetectSessionBoxes(new LuxonSessionClock());
const sweeps = new DetectLiquiditySweeps();

async function fetchBybit(interval: "5" | "60", limit: number, endMs?: number): Promise<Candle[]> {
  const url = new URL("https://api.bybit.com/v5/market/kline");
  url.searchParams.set("category", "spot");
  url.searchParams.set("symbol", "BTCUSDT");
  url.searchParams.set("interval", interval);
  url.searchParams.set("limit", String(limit));
  if (endMs != null) {
    url.searchParams.set("end", String(endMs));
  }

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Bybit ${response.status}: ${await response.text()}`);
  }

  const body = (await response.json()) as {
    retCode: number;
    retMsg: string;
    result?: { list?: [string, string, string, string, string, string, string][] };
  };
  if (body.retCode !== 0) {
    throw new Error(`Bybit ${body.retCode}: ${body.retMsg}`);
  }

  return [...(body.result?.list ?? [])].reverse().map((row) =>
    Candle.from({
      openTime: Number(row[0]),
      open: Number(row[1]),
      high: Number(row[2]),
      low: Number(row[3]),
      close: Number(row[4]),
      volume: Number(row[5]),
    }),
  );
}

function slice(candles: Candle[], fromUtc: number, toUtc: number): Candle[] {
  return candles.filter((candle) => candle.openTime >= fromUtc && candle.openTime <= toUtc);
}

async function render(
  id: string,
  title: string,
  candles: Candle[],
  timeframe: ChartTimeframe,
): Promise<void> {
  if (candles.length === 0) {
    throw new Error(`${id}: нет свечей`);
  }

  const boxes = detector.detect(candles, SessionHours.all(), timeframe);
  const liquidity = sweeps.detect(candles, boxes, SweepRules.default());
  const chart = Chart.compose(id, title, candles, ChartStyle.default(), timeframe, boxes, liquidity);
  const image = await painter.paint(chart);
  const file = path.join(outDir, `${id}.png`);
  await writeFile(file, image.bytes);
  console.log(`${id}: candles=${candles.length} boxes=${boxes.length} sweeps=${liquidity.length}`);
  console.log(`  ${file}`);
}

await mkdir(outDir, { recursive: true });

const hourly = await fetchBybit("60", 144);
const fiveMin = await fetchBybit("5", 288);

await render("check-1h-full", "BTCUSDT 1H · как /test", hourly, "1h");
await render(
  "check-1h-tokyo-30",
  "BTCUSDT 1H · Tokyo 30.08 SSL",
  slice(hourly, Date.UTC(2026, 7, 29, 20, 0, 0), Date.UTC(2026, 7, 30, 16, 0, 0)),
  "1h",
);
await render(
  "check-1h-ny-02",
  "BTCUSDT 1H · NY 02.09",
  slice(hourly, Date.UTC(2026, 8, 2, 6, 0, 0), Date.UTC(2026, 8, 2, 22, 0, 0)),
  "1h",
);
await render("check-1h-now", "BTCUSDT 1H · последние 36ч", hourly.slice(-36), "1h");
await render("check-5m-24h", "BTCUSDT 5m · 24ч", fiveMin, "5m");
