import path from "node:path";
import { fileURLToPath } from "node:url";
import { DEFAULT_RENDER_CANDLES, type ChartTimeframe } from "@volium/contracts";
import { Candle } from "../domain/chart/candle.ts";
import { loadCandlesFromCsv } from "../infrastructure/market-data/load-candles-from-csv.ts";

const here = path.dirname(fileURLToPath(import.meta.url));
const csvPath = path.resolve(here, "../../data/btcusdt-5m.csv");
const baseUrl = process.env.PUBLIC_BASE_URL ?? "http://localhost:8000";
const secret = process.env.RENDERER_SECRET ?? "dev-secret";

function sliceLast(candles: Candle[], count: number): Candle[] {
  return candles.slice(Math.max(0, candles.length - count));
}

function aggregate(candles: Candle[], bucketMs: number): Candle[] {
  const groups = new Map<number, Candle[]>();
  for (const candle of candles) {
    const openTime = candle.openTime - (candle.openTime % bucketMs);
    const bucket = groups.get(openTime) ?? [];
    bucket.push(candle);
    groups.set(openTime, bucket);
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

function toDto(candle: Candle): {
  openTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
} {
  return {
    openTime: candle.openTime,
    open: candle.open,
    high: candle.high,
    low: candle.low,
    close: candle.close,
    volume: candle.volume,
  };
}

async function fetchKlines(interval: "1d" | "1h", limit: number): Promise<Candle[]> {
  const url = new URL("https://api.binance.com/api/v3/klines");
  url.searchParams.set("symbol", "BTCUSDT");
  url.searchParams.set("interval", interval);
  url.searchParams.set("limit", String(limit));
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

async function post(payload: {
  requestId: string;
  symbol: string;
  title: string;
  timeframe: ChartTimeframe;
  candles: Candle[];
  layers?: { sessions?: boolean; sweeps?: boolean };
}): Promise<void> {
  const body: Record<string, unknown> = {
    requestId: payload.requestId,
    symbol: payload.symbol,
    title: payload.title,
    timeframe: payload.timeframe,
    candles: payload.candles.map(toDto),
  };
  if (payload.layers != null) {
    body.layers = payload.layers;
  }

  const response = await fetch(`${baseUrl}/render`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${secret}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  console.log(`${payload.requestId}: ${response.status} ${text}`);
}

const all = await loadCandlesFromCsv(csvPath);
if (all.length === 0) {
  throw new Error(`CSV пустой: ${csvPath}`);
}

const hourly = aggregate(all, 3_600_000);
const daily = await fetchKlines("1d", DEFAULT_RENDER_CANDLES);
const fiveMin = sliceLast(all, DEFAULT_RENDER_CANDLES);
console.log(
  `preview candles: 1d=${daily.length} 1h=${Math.min(hourly.length, DEFAULT_RENDER_CANDLES)} 5m=${fiveMin.length}`,
);

await post({
  requestId: "preview-1d",
  symbol: "BTCUSDT",
  title: "BTCUSDT 1D · без слоёв",
  timeframe: "1d",
  candles: sliceLast(daily, DEFAULT_RENDER_CANDLES),
});

await post({
  requestId: "preview-1h",
  symbol: "BTCUSDT",
  title: "BTCUSDT 1H · сессии + свипы",
  timeframe: "1h",
  candles: sliceLast(hourly, DEFAULT_RENDER_CANDLES),
  layers: { sessions: true, sweeps: true },
});

await post({
  requestId: "preview-5m",
  symbol: "BTCUSDT",
  title: "BTCUSDT 5m · только сессии",
  timeframe: "5m",
  candles: fiveMin,
  layers: { sessions: true, sweeps: false },
});
