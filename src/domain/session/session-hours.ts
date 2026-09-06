import { SessionSpec } from "./session-spec.ts";

export class SessionHours {
  static tokyo(): SessionSpec {
    return SessionSpec.define({
      enabled: true,
      title: "Tokyo",
      timeZone: "Asia/Tokyo",
      startHour: 9,
      startMinute: 0,
      endHour: 16,
      endMinute: 0,
      color: "#b39ddb",
    });
  }

  static preLondon(): SessionSpec {
    return SessionSpec.define({
      enabled: true,
      title: "pre-London",
      timeZone: "Europe/Berlin",
      startHour: 8,
      startMinute: 0,
      endHour: 9,
      endMinute: 0,
      color: "#ef9a9a",
    });
  }

  static london(): SessionSpec {
    return SessionSpec.define({
      enabled: true,
      title: "London",
      timeZone: "Europe/London",
      startHour: 8,
      startMinute: 0,
      endHour: 16,
      endMinute: 30,
      color: "#81c784",
    });
  }

  static newYork(): SessionSpec {
    return SessionSpec.define({
      enabled: true,
      title: "New York",
      timeZone: "America/New_York",
      startHour: 9,
      startMinute: 30,
      endHour: 16,
      endMinute: 0,
      color: "#64b5f6",
    });
  }

  static all(): SessionSpec[] {
    return [SessionHours.tokyo(), SessionHours.preLondon(), SessionHours.london(), SessionHours.newYork()];
  }

  static chartBoxes(): SessionSpec[] {
    return [SessionHours.tokyo(), SessionHours.london(), SessionHours.newYork()];
  }
}
