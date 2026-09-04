import type { CandleDto, ChartTimeframe, SessionNoticeDto } from "@volium/contracts";
import { Candle } from "../chart/candle.ts";
import { DetectInternalSweeps } from "./detect-internal-sweeps.ts";
import { DetectLiquiditySweeps } from "./detect-liquidity-sweeps.ts";
import { DetectSessionBoxes } from "./detect-session-boxes.ts";
import { sessionSweepNotice } from "./liquidity-sweep.ts";
import type { SessionClock } from "./session-clock.ts";
import { TradeProfile } from "./trade-profile.ts";
import { VoliumSessions } from "./volium-sessions.ts";
import { VoliumSweeps } from "./volium-sweeps.ts";

export const SESSION_CLOSE_GRACE_MS = 6 * 60 * 60 * 1000;
export const SESSION_SWEEP_LOOKBACK_MS = SESSION_CLOSE_GRACE_MS;

export class SessionNotices {
  private readonly boxes: DetectSessionBoxes;
  private readonly sweeps = new DetectLiquiditySweeps();
  private readonly internal = new DetectInternalSweeps();

  constructor(private readonly clock: SessionClock) {
    this.boxes = new DetectSessionBoxes(clock);
  }

  list(
    symbol: string,
    hourly: CandleDto[],
    nowUtcMs: number,
    timeframe: ChartTimeframe = "1h",
  ): SessionNoticeDto[] {
    const notices: SessionNoticeDto[] = [];
    const profile = TradeProfile.for(symbol);
    if (profile == null) {
      return notices;
    }

    for (const window of profile.sessionWindows) {
      const { start, end } = window.bounds(this.clock, nowUtcMs);
      if (nowUtcMs >= start && nowUtcMs < end) {
        notices.push({
          id: `session-open:${symbol}:${window.title}:${start}`,
          text: `${window.title} открылась`,
          kind: "open",
        });
      } else if (nowUtcMs >= end && nowUtcMs < end + SESSION_CLOSE_GRACE_MS) {
        notices.push({
          id: `session-close:${symbol}:${window.title}:${start}`,
          text: `${window.title} закрылась`,
          kind: "close",
        });
      }
    }

    const since = nowUtcMs - SESSION_SWEEP_LOOKBACK_MS;
    const candles = hourly.map((candle) => Candle.from(candle));
    const sessionBoxes = this.boxes.detect(candles, VoliumSessions.chartBoxes(), timeframe);
    const found = [
      ...this.sweeps.detect(candles, sessionBoxes, VoliumSweeps.default()),
      ...this.internal.detect(candles, sessionBoxes, timeframe),
    ];
    for (const sweep of found) {
      if (sweep.sweepBarTime <= since) {
        continue;
      }
      notices.push({
        id:
          sweep.pool === "internal"
            ? `session-liquidity:internal:${symbol}:${sweep.fromBarTime}:${sweep.side}`
            : `session-liquidity:${symbol}:${sweep.fromBarTime}:${sweep.side}`,
        text: sessionSweepNotice(sweep),
        kind: "liquidity",
      });
    }

    return notices;
  }
}
