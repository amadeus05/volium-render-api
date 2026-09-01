import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SYMBOL = "BTCUSDT";
const INTERVAL = "5m";
const LIMIT = 1000;
const DAY_MS = 86_400_000;
const here = path.dirname(fileURLToPath(import.meta.url));
const outFile = path.resolve(here, "../../data/btcusdt-5m.csv");

type Kline = [number, string, string, string, string, string, ...unknown[]];

async function fetchKlines(startTime: number, endTime: number): Promise<Kline[]> {
  const url = new URL("https://api.binance.com/api/v3/klines");
  url.searchParams.set("symbol", SYMBOL);
  url.searchParams.set("interval", INTERVAL);
  url.searchParams.set("startTime", String(startTime));
  url.searchParams.set("endTime", String(endTime));
  url.searchParams.set("limit", String(LIMIT));

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Binance ${response.status}: ${await response.text()}`);
  }

  return (await response.json()) as Kline[];
}

async function downloadMonth(): Promise<Kline[]> {
  const endTime = Date.now();
  let startTime = endTime - 30 * DAY_MS;
  const all: Kline[] = [];

  while (startTime < endTime) {
    const batch = await fetchKlines(startTime, endTime);
    if (batch.length === 0) {
      break;
    }

    all.push(...batch);
    const last = batch[batch.length - 1];
    if (last == null) {
      break;
    }

    startTime = last[0] + 1;
    if (batch.length < LIMIT) {
      break;
    }
  }

  const unique = new Map<number, Kline>();
  for (const row of all) {
    unique.set(row[0], row);
  }

  return [...unique.values()].sort((a, b) => a[0] - b[0]);
}

const rows = await downloadMonth();
await mkdir(path.dirname(outFile), { recursive: true });

const csv = [
  "openTime,openTimeIso,open,high,low,close,volume",
  ...rows.map((row) => {
    const [openTime, open, high, low, close, volume] = row;
    return `${openTime},${new Date(openTime).toISOString()},${open},${high},${low},${close},${volume}`;
  }),
].join("\n");

await writeFile(outFile, `${csv}\n`, "utf8");
const first = rows[0];
const last = rows[rows.length - 1];
console.log(
  `saved ${rows.length} candles ${first ? new Date(first[0]).toISOString() : "?"} → ${last ? new Date(last[0]).toISOString() : "?"} → ${outFile}`,
);
