import type { Candle } from "../chart/candle.ts";
import type { SessionBox } from "./session-box.ts";
import { LiquiditySweep } from "./liquidity-sweep.ts";
import type { SweepRoute } from "./sweep-route.ts";
import { SweepSide, type SweepTouch } from "./sweep-touch.ts";

export class DetectLiquiditySweeps {
  detect(candles: Candle[], boxes: SessionBox[], routes: SweepRoute[]): LiquiditySweep[] {
    const sweeps: LiquiditySweep[] = [];

    for (const route of routes) {
      if (route.targets.length === 0) {
        continue;
      }

      const sources = boxes
        .filter((box) => box.title === route.source)
        .sort((a, b) => a.winStart - b.winStart);

      for (const fromBox of sources) {
        const targets = route.targets.flatMap((title) => {
          const next = nextBox(fromBox, boxes.filter((box) => box.title === title));
          return next == null ? [] : [next];
        });

        sweeps.push(...this.hunt(candles, fromBox, targets, route.touch, route.sides));
      }
    }

    return sweeps;
  }

  private hunt(
    candles: Candle[],
    fromBox: SessionBox,
    targets: SessionBox[],
    touch: SweepTouch[],
    sides: SweepSide[],
  ): LiquiditySweep[] {
    if (targets.length === 0) {
      return [];
    }

    const found: LiquiditySweep[] = [];
    let tookHigh = !sides.includes(SweepSide.High);
    let tookLow = !sides.includes(SweepSide.Low);

    for (const candle of candles) {
      if (candle.openTime <= fromBox.lastBarTime) {
        continue;
      }

      const toBox = boxContaining(targets, candle.openTime);
      if (toBox == null) {
        continue;
      }

      if (!tookHigh && breachesHigh(candle, fromBox.high, touch)) {
        found.push(
          new LiquiditySweep(
            fromBox.title,
            toBox.title,
            SweepSide.High,
            fromBox.high,
            fromBox.highTime,
            candle.openTime,
          ),
        );
        tookHigh = true;
      }

      if (!tookLow && breachesLow(candle, fromBox.low, touch)) {
        found.push(
          new LiquiditySweep(
            fromBox.title,
            toBox.title,
            SweepSide.Low,
            fromBox.low,
            fromBox.lowTime,
            candle.openTime,
          ),
        );
        tookLow = true;
      }

      if (tookHigh && tookLow) {
        break;
      }
    }

    return found;
  }
}

function nextBox(fromBox: SessionBox, candidates: SessionBox[]): SessionBox | undefined {
  return candidates
    .filter((box) => box.winStart > fromBox.winStart)
    .sort((a, b) => a.winStart - b.winStart)[0];
}

function boxContaining(boxes: SessionBox[], openTime: number): SessionBox | undefined {
  return boxes.find((box) => openTime >= box.winStart && openTime <= box.lastBarTime);
}

function breachesHigh(candle: Candle, level: number, touch: SweepTouch[]): boolean {
  const wick = touch.includes("wick") && candle.high > level;
  const body = touch.includes("body") && Math.max(candle.open, candle.close) > level;
  return wick || body;
}

function breachesLow(candle: Candle, level: number, touch: SweepTouch[]): boolean {
  const wick = touch.includes("wick") && candle.low < level;
  const body = touch.includes("body") && Math.min(candle.open, candle.close) < level;
  return wick || body;
}
