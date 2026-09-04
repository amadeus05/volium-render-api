import { SweepRoute } from "./sweep-route.ts";
import { SweepTouch } from "./sweep-touch.ts";

export class SweepRules {
  static default(): SweepRoute[] {
    return [
      // .to(A, B) — кто первый снял уровень, тот и отмечается. Не два маркера подряд.
      SweepRoute.from("Tokyo").to("London", "New York").via(SweepTouch.Wick),
    ];
  }
}
