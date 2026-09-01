import { DateTime } from "luxon";
import type { LocalYmd, SessionClock } from "../../domain/session/session-clock.ts";

export class LuxonSessionClock implements SessionClock {
  localYmd(utcMs: number, timeZone: string): LocalYmd {
    const dt = DateTime.fromMillis(utcMs, { zone: timeZone });
    return { year: dt.year, month: dt.month, day: dt.day };
  }

  at(
    timeZone: string,
    year: number,
    month: number,
    day: number,
    hour: number,
    minute: number,
  ): number {
    return DateTime.fromObject(
      { year, month, day, hour, minute, second: 0, millisecond: 0 },
      { zone: timeZone },
    ).toMillis();
  }
}
