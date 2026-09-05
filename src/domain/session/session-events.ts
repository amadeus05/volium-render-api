import type { CandleDto, ChartTimeframe, SessionEventDto } from "@volium/contracts";
import { Candle } from "../chart/candle.ts";
import { DetectInternalSweeps } from "./detect-internal-sweeps.ts";
import { DetectLiquiditySweeps } from "./detect-liquidity-sweeps.ts";
import { DetectSessionBoxes } from "./detect-session-boxes.ts";
import { sessionSweepText } from "./liquidity-sweep.ts";
import type { SessionClockPort } from "./session-clock.port.ts";
import { TradeProfile } from "./trade-profile.ts";
import { SessionHours } from "./session-hours.ts";
import { SweepRules } from "./sweep-rules.ts";

export const SESSION_CLOSE_GRACE_MS = 6 * 60 * 60 * 1000;
export const SESSION_SWEEP_LOOKBACK_MS = SESSION_CLOSE_GRACE_MS;

export class SessionEvents {
  private readonly boxes: DetectSessionBoxes;
  private readonly sweeps = new DetectLiquiditySweeps();
  private readonly internal = new DetectInternalSweeps();

  constructor(private readonly clock: SessionClockPort) {
    this.boxes = new DetectSessionBoxes(clock);
  }

  list(
    symbol: string,
    hourly: CandleDto[],
    nowUtcMs: number,
    timeframe: ChartTimeframe = "1h",
  ): SessionEventDto[] {
    const events: SessionEventDto[] = [];
    const profile = TradeProfile.for(symbol);
    if (profile == null) {
      return events;
    }

    for (const window of profile.sessionWindows) {
      const { start, end } = window.bounds(this.clock, nowUtcMs);
      if (nowUtcMs >= start && nowUtcMs < end) {
        events.push({
          id: `session-open:${symbol}:${window.title}:${start}`,
          text: `${window.title} открылась`,
          kind: "open",
        });
      } else if (nowUtcMs >= end && nowUtcMs < end + SESSION_CLOSE_GRACE_MS) {
        events.push({
          id: `session-close:${symbol}:${window.title}:${start}`,
          text: `${window.title} закрылась`,
          kind: "close",
        });
      }
    }

    const since = nowUtcMs - SESSION_SWEEP_LOOKBACK_MS;
    const candles = hourly.map((candle) => Candle.from(candle));
    const sessionBoxes = this.boxes.detect(candles, SessionHours.chartBoxes(), timeframe);
    const found = [
      ...this.sweeps.detect(candles, sessionBoxes, SweepRules.default()),
      ...this.internal.detect(candles, sessionBoxes, timeframe),
    ];
    for (const sweep of found) {
      if (sweep.sweepBarTime <= since) {
        continue;
      }
      events.push({
        id:
          sweep.pool === "internal"
            ? `session-liquidity:internal:${symbol}:${sweep.fromBarTime}:${sweep.side}`
            : `session-liquidity:${symbol}:${sweep.fromBarTime}:${sweep.side}`,
        text: sessionSweepText(sweep),
        kind: "liquidity",
      });
    }

    return events;
  }
}
