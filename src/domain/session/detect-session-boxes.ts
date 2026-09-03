import { isIntraday } from "@volium/contracts";
import type { ChartTimeframe } from "@volium/contracts";
import type { Candle } from "../chart/candle.ts";
import { SessionBox } from "./session-box.ts";
import type { SessionClock } from "./session-clock.ts";
import type { SessionSpec } from "./session-spec.ts";

export class DetectSessionBoxes {
  constructor(private readonly clock: SessionClock) {}

  detect(candles: Candle[], specs: SessionSpec[], timeframe: ChartTimeframe): SessionBox[] {
    if (!isIntraday(timeframe) || candles.length === 0) {
      return [];
    }

    const boxes: SessionBox[] = [];
    for (const spec of specs) {
      if (!spec.enabled) {
        continue;
      }

      boxes.push(...this.walk(candles, spec));
    }

    return boxes;
  }

  private walk(candles: Candle[], spec: SessionSpec): SessionBox[] {
    const boxes: SessionBox[] = [];
    let live = false;
    let winStart = Number.NaN;
    let firstBarTime = 0;
    let hi = 0;
    let lo = 0;
    let highTime = 0;
    let lowTime = 0;
    let lastBarTime = 0;

    const commit = (): void => {
      boxes.push(
        new SessionBox(
          spec.title,
          spec.color,
          winStart,
          firstBarTime,
          lastBarTime,
          hi,
          lo,
          highTime,
          lowTime,
        ),
      );
    };

    for (const candle of candles) {
      const t = candle.openTime;
      const ymd = this.clock.localYmd(t, spec.timeZone);
      const start = this.clock.at(
        spec.timeZone,
        ymd.year,
        ymd.month,
        ymd.day,
        spec.startHour,
        spec.startMinute,
      );
      const end = this.clock.at(
        spec.timeZone,
        ymd.year,
        ymd.month,
        ymd.day,
        spec.endHour,
        spec.endMinute,
      );
      const inside = t >= start && t < end;

      if (inside) {
        const newWindow = !live || winStart !== start;
        if (newWindow) {
          if (live) {
            commit();
          }

          live = true;
          winStart = start;
          firstBarTime = t;
          hi = candle.high;
          lo = candle.low;
          highTime = t;
          lowTime = t;
          lastBarTime = t;
        } else {
          if (candle.high > hi) {
            hi = candle.high;
            highTime = t;
          }
          if (candle.low < lo) {
            lo = candle.low;
            lowTime = t;
          }
          lastBarTime = t;
        }
      } else if (live) {
        commit();
        live = false;
      }
    }

    if (live) {
      commit();
    }

    return boxes;
  }
}
