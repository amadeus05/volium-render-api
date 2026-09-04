import type { SessionSpec } from "./session-spec.ts";
import { SessionHours } from "./session-hours.ts";

export class TradeProfile {
  private constructor(private readonly windows: readonly SessionSpec[]) {}

  static for(symbol: string): TradeProfile | null {
    if (symbol === "BTCUSDT") {
      return TradeProfile.btc();
    }
    return null;
  }

  static btc(): TradeProfile {
    return new TradeProfile([SessionHours.london(), SessionHours.newYork()]);
  }

  get sessionWindows(): readonly SessionSpec[] {
    return this.windows;
  }
}
