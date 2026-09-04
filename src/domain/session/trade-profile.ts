import type { SessionSpec } from "./session-spec.ts";
import { VoliumSessions } from "./volium-sessions.ts";

export class TradeProfile {
  private constructor(private readonly windows: readonly SessionSpec[]) {}

  static for(symbol: string): TradeProfile | null {
    if (symbol === "BTCUSDT") {
      return TradeProfile.btc();
    }
    return null;
  }

  static btc(): TradeProfile {
    return new TradeProfile([VoliumSessions.london(), VoliumSessions.newYork()]);
  }

  get sessionWindows(): readonly SessionSpec[] {
    return this.windows;
  }
}
