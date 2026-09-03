import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DateTime } from "luxon";
import type { ChartTimeframe } from "@volium/contracts";
import { Candle } from "../domain/chart/candle.ts";
import { Chart } from "../domain/chart/chart.ts";
import { ChartStyle } from "../domain/chart/chart-style.ts";
import { DetectSessionBoxes } from "../domain/session/detect-session-boxes.ts";
import { VoliumSessions } from "../domain/session/volium-sessions.ts";
import { CanvasChartPainter } from "../infrastructure/canvas/canvas-chart.painter.ts";
import { LuxonSessionClock } from "../infrastructure/time/luxon-session.clock.ts";

const DAY_START = Date.UTC(2026, 8, 2, 0, 0, 0);
const DAY_END = Date.UTC(2026, 8, 3, 0, 0, 0);
const BAR_MS = 300_000;

const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(here, "../../output/charts");
const clock = new LuxonSessionClock();
const detector = new DetectSessionBoxes(clock);
const painter = new CanvasChartPainter();

function fmt(utcMs: number): string {
  return DateTime.fromMillis(utcMs, { zone: "utc" }).toFormat("yyyy-LL-dd HH:mm");
}

async function fetchFiveMin(): Promise<Candle[]> {
  const url = new URL("https://api.binance.com/api/v3/klines");
  url.searchParams.set("symbol", "BTCUSDT");
  url.searchParams.set("interval", "5m");
  url.searchParams.set("startTime", String(DAY_START));
  url.searchParams.set("endTime", String(DAY_END));
  url.searchParams.set("limit", "1000");
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Binance ${response.status}: ${await response.text()}`);
  }
  const rows = (await response.json()) as [number, string, string, string, string, string, ...unknown[]][];
  return rows.map((row) =>
    Candle.from({
      openTime: row[0],
      open: Number(row[1]),
      high: Number(row[2]),
      low: Number(row[3]),
      close: Number(row[4]),
      volume: Number(row[5]),
    }),
  );
}

function sliceRange(candles: Candle[], fromUtc: number, toUtc: number): Candle[] {
  return candles.filter((candle) => candle.openTime >= fromUtc && candle.openTime < toUtc);
}

async function render(
  id: string,
  title: string,
  candles: Candle[],
  timeframe: ChartTimeframe,
): Promise<void> {
  const boxes = detector.detect(candles, VoliumSessions.all(), timeframe);
  const chart = Chart.compose(id, title, candles, ChartStyle.default(), timeframe, boxes);
  const image = await painter.paint(chart);
  const file = path.join(outDir, `${id}.png`);
  await writeFile(file, image.bytes);
  console.log(`png ${id}: candles=${candles.length} boxes=${boxes.length} → ${file}`);
}

const candles = await fetchFiveMin();
if (candles.length === 0) {
  throw new Error("Binance вернул 0 свечей за 2026-09-02");
}

const boxes = detector.detect(candles, VoliumSessions.all(), "5m");
console.log(`свечи ${fmt(candles[0]!.openTime)} … ${fmt(candles[candles.length - 1]!.openTime)} (${candles.length})`);
console.log("коробки нашего кода (UTC, lastBar = open последней 5m внутри окна, визуальный правый край = lastBar+5m):");
for (const box of boxes) {
  const visualEnd = box.lastBarTime + BAR_MS;
  console.log(
    `${box.title.padEnd(12)} start=${fmt(box.winStart)} lastBar=${fmt(box.lastBarTime)} visualEnd=${fmt(visualEnd)} hi=${box.high} lo=${box.low}`,
  );
}

await mkdir(outDir, { recursive: true });
await render("verify-2026-09-02-day", "BTCUSDT 5m · 2026-09-02 UTC · сессии", candles, "5m");
await render(
  "verify-tokyo-pre",
  "BTCUSDT 5m · Tokyo + pre-London",
  sliceRange(candles, Date.UTC(2026, 8, 2, 0, 0), Date.UTC(2026, 8, 2, 7, 30)),
  "5m",
);
await render(
  "verify-london-ny",
  "BTCUSDT 5m · London + New York",
  sliceRange(candles, Date.UTC(2026, 8, 2, 6, 30), Date.UTC(2026, 8, 2, 16, 0)),
  "5m",
);
await render(
  "verify-london-end",
  "BTCUSDT 5m · London end",
  sliceRange(candles, Date.UTC(2026, 8, 2, 14, 30), Date.UTC(2026, 8, 2, 16, 10)),
  "5m",
);
await render(
  "verify-ny-end",
  "BTCUSDT 5m · New York end",
  sliceRange(candles, Date.UTC(2026, 8, 2, 18, 30), Date.UTC(2026, 8, 3, 0, 0)),
  "5m",
);
