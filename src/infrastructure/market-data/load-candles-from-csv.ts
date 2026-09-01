import { readFile } from "node:fs/promises";
import { Candle } from "../../domain/chart/candle.ts";

export async function loadCandlesFromCsv(filePath: string): Promise<Candle[]> {
  const text = await readFile(filePath, "utf8");
  const lines = text.trim().split(/\r?\n/);
  const candles: Candle[] = [];

  for (const line of lines.slice(1)) {
    if (line.length === 0) {
      continue;
    }

    const [openTime, , open, high, low, close, volume] = line.split(",");
    if (openTime == null || open == null || high == null || low == null || close == null || volume == null) {
      continue;
    }

    candles.push(
      Candle.from({
        openTime: Number(openTime),
        open: Number(open),
        high: Number(high),
        low: Number(low),
        close: Number(close),
        volume: Number(volume),
      }),
    );
  }

  return candles;
}
