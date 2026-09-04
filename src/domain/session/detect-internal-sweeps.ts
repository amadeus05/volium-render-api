import type { ChartTimeframe } from "@volium/contracts";
import type { Candle } from "../chart/candle.ts";
import type { SessionBox } from "./session-box.ts";
import { LiquiditySweep } from "./liquidity-sweep.ts";
import { SweepSide } from "./sweep-touch.ts";

export class DetectInternalSweeps {
  detect(candles: Candle[], boxes: SessionBox[], timeframe: ChartTimeframe): LiquiditySweep[] {
    if (timeframe !== "1h" || candles.length < 3 || boxes.length === 0) {
      return [];
    }

    const found: LiquiditySweep[] = [];
    for (const swing of swingsInside(candles, boxes)) {
      const taken = firstTake(candles, boxes, swing);
      if (taken != null) {
        found.push(taken);
      }
    }
    return found;
  }
}

type Swing = {
  box: SessionBox;
  side: SweepSide;
  level: number;
  barTime: number;
};

function swingsInside(candles: Candle[], boxes: SessionBox[]): Swing[] {
  const swings: Swing[] = [];
  for (let i = 1; i < candles.length - 1; i += 1) {
    const candle = candles[i];
    const left = candles[i - 1];
    const right = candles[i + 1];
    if (candle == null || left == null || right == null) {
      continue;
    }

    const box = boxContaining(boxes, candle.openTime);
    if (box == null || box.title !== "Tokyo") {
      continue;
    }

    if (candle.high > left.high && candle.high > right.high && !isExternalExtreme(box, candle, SweepSide.High)) {
      swings.push({ box, side: SweepSide.High, level: candle.high, barTime: candle.openTime });
    }
    if (candle.low < left.low && candle.low < right.low && !isExternalExtreme(box, candle, SweepSide.Low)) {
      swings.push({ box, side: SweepSide.Low, level: candle.low, barTime: candle.openTime });
    }
  }
  return swings;
}

function firstTake(candles: Candle[], boxes: SessionBox[], swing: Swing): LiquiditySweep | null {
  for (const candle of candles) {
    if (candle.openTime <= swing.barTime) {
      continue;
    }
    const taken =
      swing.side === SweepSide.High ? candle.high > swing.level : candle.low < swing.level;
    if (!taken) {
      continue;
    }
    const toBox = boxContaining(boxes, candle.openTime);
    if (toBox == null || !londonTookTokyo(swing.box, toBox, boxes)) {
      return null;
    }
    return new LiquiditySweep(
      swing.box.title,
      toBox.title,
      swing.side,
      swing.level,
      swing.barTime,
      candle.openTime,
      "internal",
    );
  }
  return null;
}

function boxContaining(boxes: SessionBox[], openTime: number): SessionBox | undefined {
  return boxes.find((box) => openTime >= box.winStart && openTime <= box.lastBarTime);
}

function londonTookTokyo(from: SessionBox, to: SessionBox, boxes: SessionBox[]): boolean {
  if (from.title !== "Tokyo" || to.title !== "London") {
    return false;
  }
  const next = boxes
    .filter((box) => box.title !== "pre-London" && box.winStart > from.winStart)
    .sort((a, b) => a.winStart - b.winStart)[0];
  return next != null && next.title === "London" && next.winStart === to.winStart;
}

function isExternalExtreme(box: SessionBox, candle: Candle, side: SweepSide): boolean {
  if (box.title !== "Tokyo") {
    return false;
  }
  if (side === SweepSide.High) {
    return candle.openTime === box.highTime && candle.high === box.high;
  }
  return candle.openTime === box.lowTime && candle.low === box.low;
}
