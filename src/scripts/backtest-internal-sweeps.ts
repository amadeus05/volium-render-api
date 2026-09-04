import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DateTime } from "luxon";
import { DEFAULT_RENDER_CANDLES } from "@volium/contracts";
import { Candle } from "../domain/chart/candle.ts";
import { Chart } from "../domain/chart/chart.ts";
import { ChartStyle } from "../domain/chart/chart-style.ts";
import { DetectInternalSweeps } from "../domain/session/detect-internal-sweeps.ts";
import { DetectLiquiditySweeps } from "../domain/session/detect-liquidity-sweeps.ts";
import { DetectSessionBoxes } from "../domain/session/detect-session-boxes.ts";
import type { LiquiditySweep } from "../domain/session/liquidity-sweep.ts";
import { VoliumSessions } from "../domain/session/volium-sessions.ts";
import { VoliumSweeps } from "../domain/session/volium-sweeps.ts";
import { CanvasChartPainter } from "../infrastructure/canvas/canvas-chart.painter.ts";
import { LuxonSessionClock } from "../infrastructure/time/luxon-session.clock.ts";

const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(
  here,
  "../../output/backtest-internal",
  DateTime.utc().toFormat("yyyy-MM-dd_HHmmss"),
);
const windowSize = DEFAULT_RENDER_CANDLES;
const painter = new CanvasChartPainter();
const boxes = new DetectSessionBoxes(new LuxonSessionClock());
const sessionSweeps = new DetectLiquiditySweeps();
const internal = new DetectInternalSweeps();

const candles = await loadHourly("BTCUSDT", DateTime.utc().minus({ months: 3 }), DateTime.utc());
const sessionBoxes = boxes.detect(candles, VoliumSessions.all(), "1h");
const sweeps: LiquiditySweep[] = [
  ...sessionSweeps.detect(candles, sessionBoxes, VoliumSweeps.default()),
  ...internal.detect(candles, sessionBoxes, "1h"),
];

await mkdir(outDir, { recursive: true });

const takeTimes = [...new Set(sweeps.map((sweep) => sweep.sweepBarTime))].sort((a, b) => a - b);
for (const takeTime of takeTimes) {
  const view = windowEndingAt(candles, takeTime, windowSize);
  const first = view[0];
  if (first == null) {
    continue;
  }
  const visible = sweeps.filter(
    (sweep) => sweep.fromBarTime >= first.openTime && sweep.sweepBarTime <= takeTime,
  );
  const chartBoxes = boxes.detect(view, VoliumSessions.all(), "1h");
  const stamp = DateTime.fromMillis(takeTime, { zone: "utc" }).toFormat("yyyy-MM-dd_HH-mm");
  const id = `internal-1h_${stamp}`;
  const chart = Chart.compose(
    id,
    `BTCUSDT 1H · снятие ${stamp} UTC`,
    view,
    ChartStyle.default(),
    "1h",
    chartBoxes,
    visible,
  );
  const image = await painter.paint(chart);
  await writeFile(path.join(outDir, `${id}.png`), image.bytes);
}

const sessionCount = sweeps.filter((sweep) => sweep.pool === "session").length;
const internalCount = sweeps.filter((sweep) => sweep.pool === "internal").length;
console.log(`свечи=${candles.length} сессионные=${sessionCount} внутренние=${internalCount} png=${takeTimes.length}`);
console.log(outDir);
for (const sweep of sweeps) {
  const when = DateTime.fromMillis(sweep.sweepBarTime, { zone: "utc" }).toFormat("yyyy-MM-dd HH:mm");
  const kind = sweep.side === "high" ? "BSL" : "SSL";
  const pool = sweep.pool === "internal" ? "внутр" : "сесс";
  console.log(`${when}  ${pool}  ${kind}  ${sweep.fromSession} → ${sweep.toSession}  ${sweep.level}`);
}

async function loadHourly(symbol: string, from: DateTime, to: DateTime): Promise<Candle[]> {
  const candles: Candle[] = [];
  let cursor = from.toMillis();
  const end = to.toMillis();

  while (cursor < end) {
    const url = new URL("https://api.binance.com/api/v3/klines");
    url.searchParams.set("symbol", symbol);
    url.searchParams.set("interval", "1h");
    url.searchParams.set("startTime", String(cursor));
    url.searchParams.set("endTime", String(end));
    url.searchParams.set("limit", "1000");

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Binance ${response.status}: ${await response.text()}`);
    }

    const rows = (await response.json()) as [number, string, string, string, string, string, ...unknown[]][];
    if (rows.length === 0) {
      break;
    }

    for (const row of rows) {
      candles.push(
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

    const last = rows[rows.length - 1];
    if (last == null) {
      break;
    }
    cursor = last[0] + 3_600_000;
    if (rows.length < 1000) {
      break;
    }
  }

  return candles;
}

function windowEndingAt(candles: Candle[], endTime: number, size: number): Candle[] {
  const end = candles.findIndex((candle) => candle.openTime === endTime);
  const last = end < 0 ? candles.length : end + 1;
  const first = Math.max(0, last - size);
  return candles.slice(first, last);
}
