import { SessionSpec } from "./session-spec.ts";

export class VoliumSessions {
  static all(): SessionSpec[] {
    return [
      SessionSpec.define({
        enabled: true,
        title: "Tokyo",
        timeZone: "Asia/Tokyo",
        startHour: 9,
        startMinute: 0,
        endHour: 16,
        endMinute: 0,
        color: "#c9a0ff",
      }),
      SessionSpec.define({
        enabled: true,
        title: "pre-London",
        timeZone: "Europe/Berlin",
        startHour: 8,
        startMinute: 0,
        endHour: 9,
        endMinute: 0,
        color: "#f0a070",
      }),
      SessionSpec.define({
        enabled: true,
        title: "London",
        timeZone: "Europe/London",
        startHour: 8,
        startMinute: 0,
        endHour: 16,
        endMinute: 30,
        color: "#7dcc90",
      }),
      SessionSpec.define({
        enabled: true,
        title: "New York",
        timeZone: "America/New_York",
        startHour: 9,
        startMinute: 30,
        endHour: 16,
        endMinute: 0,
        color: "#7eb6e8",
      }),
    ];
  }

  static chartBoxes(): SessionSpec[] {
    return VoliumSessions.all().filter((spec) => spec.title !== "pre-London");
  }
}
