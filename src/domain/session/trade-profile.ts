import { SessionSpec } from "./session-spec.ts";

export class TradeProfile {
  private constructor(private readonly windows: readonly SessionSpec[]) {}

  static for(symbol: string): TradeProfile | null {
    if (symbol === "BTCUSDT") {
      return TradeProfile.btc();
    }
    return null;
  }

  static btc(): TradeProfile {
    return new TradeProfile([
      SessionSpec.define({
        enabled: true,
        title: "London",
        timeZone: "Europe/London",
        startHour: 8,
        startMinute: 0,
        endHour: 12,
        endMinute: 0,
        color: "#7dcc90",
      }),
      SessionSpec.define({
        enabled: true,
        title: "New York",
        timeZone: "America/New_York",
        startHour: 9,
        startMinute: 30,
        endHour: 11,
        endMinute: 30,
        color: "#7eb6e8",
      }),
    ]);
  }

  get sessionWindows(): readonly SessionSpec[] {
    return this.windows;
  }
}
