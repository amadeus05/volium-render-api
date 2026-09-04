import assert from "node:assert/strict";
import { test } from "node:test";
import { DateTime } from "luxon";
import type { CandleDto } from "@volium/contracts";
import { Candle } from "../src/domain/chart/candle.ts";
import { DetectInternalSweeps } from "../src/domain/session/detect-internal-sweeps.ts";
import { DetectLiquiditySweeps } from "../src/domain/session/detect-liquidity-sweeps.ts";
import { DetectSessionBoxes } from "../src/domain/session/detect-session-boxes.ts";
import { SessionSpec } from "../src/domain/session/session-spec.ts";
import { SweepRoute } from "../src/domain/session/sweep-route.ts";
import { SweepSide, SweepTouch } from "../src/domain/session/sweep-touch.ts";
import { SessionHours } from "../src/domain/session/session-hours.ts";
import { SweepRules } from "../src/domain/session/sweep-rules.ts";
import { LuxonSessionClock } from "../src/infrastructure/time/luxon-session.clock.ts";

const boxes = new DetectSessionBoxes(new LuxonSessionClock());
const sweeps = new DetectLiquiditySweeps();
const internal = new DetectInternalSweeps();
const day = "2026-09-02";

test("1d — коробок нет", () => {
  assert.deepEqual(boxes.detect(hours(day), SessionHours.all(), "1d"), []);
});

test("лето: London 07:00–15:00 UTC, хай/лой окна", () => {
  const candles = [
    bar(`${day}T07:00:00Z`, { high: 77100, low: 76900 }),
    bar(`${day}T10:00:00Z`, { high: 78000, low: 77000 }),
    bar(`${day}T15:00:00Z`, { high: 77500, low: 76800 }),
  ];
  const found = boxes.detect(candles, [SessionHours.london()], "1h");
  assert.equal(found.length, 1);
  assert.equal(found[0]?.title, "London");
  assert.equal(found[0]?.firstBarTime, utc(`${day}T07:00:00Z`));
  assert.equal(found[0]?.lastBarTime, utc(`${day}T15:00:00Z`));
  assert.equal(found[0]?.high, 78000);
  assert.equal(found[0]?.highTime, utc(`${day}T10:00:00Z`));
  assert.equal(found[0]?.low, 76800);
  assert.equal(found[0]?.lowTime, utc(`${day}T15:00:00Z`));
});

test("выключенный spec — коробок нет", () => {
  const off = SessionSpec.define({
    enabled: false,
    title: "London",
    timeZone: "Europe/London",
    startHour: 8,
    startMinute: 0,
    endHour: 16,
    endMinute: 30,
    color: "#7dcc90",
  });
  assert.deepEqual(boxes.detect(hours(day), [off], "1h"), []);
});

test("BSL: фитиль Лондона снял хай Tokyo", () => {
  const candles = hours(day, {
    "02:00": { high: 77902, low: 77000 },
    "07:00": { open: 77600, high: 78175, low: 77500, close: 77700 },
  });
  const found = sweeps.detect(
    candles.map((c) => Candle.from(c)),
    boxes.detect(candles, SessionHours.chartBoxes(), "1h"),
    SweepRules.default(),
  );
  assert.equal(found.length, 1);
  assert.equal(found[0]?.fromSession, "Tokyo");
  assert.equal(found[0]?.toSession, "London");
  assert.equal(found[0]?.side, SweepSide.High);
  assert.equal(found[0]?.level, 77902);
  assert.equal(found[0]?.sweepBarTime, utc(`${day}T07:00:00Z`));
});

test("SSL: фитиль Лондона снял лой Tokyo", () => {
  const candles = hours(day, {
    "02:00": { high: 77500, low: 76800 },
    "07:00": { open: 77200, high: 77300, low: 76700, close: 77100 },
  });
  const found = sweeps.detect(
    candles.map((c) => Candle.from(c)),
    boxes.detect(candles, SessionHours.chartBoxes(), "1h"),
    SweepRules.default(),
  );
  assert.equal(found.length, 1);
  assert.equal(found[0]?.side, SweepSide.Low);
  assert.equal(found[0]?.level, 76800);
  assert.equal(found[0]?.toSession, "London");
});

test("только body: фитиль выше хая, тело нет — снятия нет", () => {
  const candles = hours(day, {
    "02:00": { high: 77902, low: 77000 },
    "07:00": { open: 77600, high: 78175, low: 77500, close: 77800 },
  });
  const found = sweeps.detect(
    candles.map((c) => Candle.from(c)),
    boxes.detect(candles, SessionHours.chartBoxes(), "1h"),
    [SweepRoute.from("Tokyo").to("London").via(SweepTouch.Body)],
  );
  assert.deepEqual(found, []);
});

test("кто первый снял: London, не New York", () => {
  const candles = hours(day, {
    "02:00": { high: 77902, low: 77000 },
    "07:00": { high: 78100, low: 77500 },
    "14:00": { high: 78200, low: 77400 },
  });
  const found = sweeps.detect(
    candles.map((c) => Candle.from(c)),
    boxes.detect(candles, SessionHours.chartBoxes(), "1h"),
    SweepRules.default(),
  );
  assert.equal(found.length, 1);
  assert.equal(found[0]?.toSession, "London");
  assert.equal(found[0]?.sweepBarTime, utc(`${day}T07:00:00Z`));
});

test("снятие до закрытия source — не считается", () => {
  const candles = hours(day, {
    "02:00": { high: 77902, low: 77000 },
    "05:00": { high: 78100, low: 77500 },
  });
  const found = sweeps.detect(
    candles.map((c) => Candle.from(c)),
    boxes.detect(candles, SessionHours.chartBoxes(), "1h"),
    SweepRules.default(),
  );
  assert.deepEqual(found, []);
});

test("внутренняя SSL Азии: ближний лой, потом дальний — два снятия Лондоном", () => {
  const candles = hours(day, {
    "01:00": { high: 79800, low: 79000 },
    "02:00": { high: 79700, low: 78000 },
    "03:00": { high: 79600, low: 78900 },
    "04:00": { high: 79500, low: 78800 },
    "05:00": { high: 79400, low: 78950 },
    "06:00": { high: 79300, low: 78940 },
    "07:00": { high: 79200, low: 78700 },
    "08:00": { high: 79100, low: 77900 },
  });
  const found = internal.detect(candles, boxes.detect(candles, SessionHours.chartBoxes(), "1h"), "1h");
  const ssl = found.filter((item) => item.fromSession === "Tokyo" && item.side === SweepSide.Low);
  assert.equal(ssl.length, 2);
  const near = ssl.find((item) => item.level === 78800);
  const far = ssl.find((item) => item.level === 78000);
  assert.equal(near?.toSession, "London");
  assert.equal(near?.pool, "internal");
  assert.equal(near?.sweepBarTime, utc(`${day}T07:00:00Z`));
  assert.equal(far?.sweepBarTime, utc(`${day}T08:00:00Z`));
});

test("внутренняя: одна свеча Лондона сняла оба лоя Азии", () => {
  const candles = hours(day, {
    "01:00": { high: 79800, low: 79000 },
    "02:00": { high: 79700, low: 78000 },
    "03:00": { high: 79600, low: 78900 },
    "04:00": { high: 79500, low: 78800 },
    "05:00": { high: 79400, low: 78950 },
    "06:00": { high: 79300, low: 78940 },
    "07:00": { high: 79200, low: 78920 },
    "08:00": { high: 79100, low: 77900 },
  });
  const found = internal.detect(candles, boxes.detect(candles, SessionHours.chartBoxes(), "1h"), "1h");
  const ssl = found.filter((item) => item.fromSession === "Tokyo" && item.side === SweepSide.Low);
  assert.equal(ssl.length, 2);
  assert.equal(ssl[0]?.toSession, "London");
  assert.equal(ssl[0]?.sweepBarTime, utc(`${day}T08:00:00Z`));
  assert.equal(ssl[1]?.sweepBarTime, utc(`${day}T08:00:00Z`));
});

test("Лондон сам себя не снимает", () => {
  const candles = hours(day, {
    "07:00": { high: 79800, low: 79000 },
    "08:00": { high: 79900, low: 78000 },
    "09:00": { high: 80500, low: 79200 },
    "12:00": { high: 79400, low: 77900 },
  });
  const found = internal.detect(candles, boxes.detect(candles, SessionHours.chartBoxes(), "1h"), "1h");
  assert.equal(
    found.some((item) => item.fromSession === "London" && item.toSession === "London"),
    false,
  );
});

test("хай Tokyo как сессионный — не внутренний", () => {
  const candles = hours(day, {
    "02:00": { high: 77902, low: 77000 },
    "07:00": { open: 77600, high: 78175, low: 77500, close: 77700 },
  });
  const sessionBoxes = boxes.detect(candles, SessionHours.chartBoxes(), "1h");
  const found = internal.detect(candles, sessionBoxes, "1h");
  assert.equal(
    found.some((item) => item.fromSession === "Tokyo" && item.level === 77902),
    false,
  );
});

test("внутренние свипы только на 1h", () => {
  const candles = hours(day, {
    "08:00": { high: 79900, low: 78000 },
    "10:00": { high: 80400, low: 78800 },
    "12:00": { high: 79400, low: 77900 },
  });
  assert.deepEqual(
    internal.detect(candles, boxes.detect(candles, SessionHours.chartBoxes(), "1h"), "5m"),
    [],
  );
});

test("Лондон снимает внутренний лой Азии — предсессия, не дальше", () => {
  const candles = hours(day, {
    "01:00": { high: 79800, low: 79000 },
    "02:00": { high: 79700, low: 78500 },
    "03:00": { high: 79600, low: 78600 },
    "04:00": { high: 79500, low: 78700 },
    "05:00": { high: 79400, low: 78800 },
    "06:00": { high: 79300, low: 78750 },
    "07:00": { high: 79350, low: 78700 },
    "08:00": { high: 79200, low: 78400 },
  });
  const found = internal.detect(candles, boxes.detect(candles, SessionHours.chartBoxes(), "1h"), "1h");
  const take = found.find((item) => item.fromSession === "Tokyo" && item.level === 78500);
  assert.equal(take?.toSession, "London");
  assert.equal(take?.pool, "internal");
  assert.equal(take?.sweepBarTime, utc(`${day}T08:00:00Z`));
});

test("бред: если Азия сама сняла хай — Лондон его не снимает", () => {
  const candles = hours(day, {
    "01:00": { high: 79000, low: 78400 },
    "02:00": { high: 80000, low: 78600 },
    "03:00": { high: 79800, low: 78700 },
    "04:00": { high: 80100, low: 78800 },
    "05:00": { high: 79900, low: 78900 },
    "06:00": { high: 79850, low: 78850 },
    "07:00": { high: 80200, low: 79000 },
  });
  const found = internalsOf(candles);
  assert.equal(
    found.some((item) => item.side === SweepSide.High && item.level === 80000),
    false,
  );
});

test("бред: если Азия сама сняла лой — Лондон его не снимает", () => {
  const candles = hours(day, {
    "01:00": { high: 79800, low: 79000 },
    "02:00": { high: 79700, low: 78500 },
    "03:00": { high: 79600, low: 78600 },
    "04:00": { high: 79500, low: 78400 },
    "05:00": { high: 79400, low: 78800 },
    "06:00": { high: 79300, low: 78750 },
    "07:00": { high: 79200, low: 78300 },
  });
  const found = internalsOf(candles);
  assert.equal(
    found.some((item) => item.side === SweepSide.Low && item.level === 78500),
    false,
  );
});

test("у любой внутренней стрелки первое снятие — Лондон, до него уровень цел", () => {
  const quiet = { high: 79800, low: 78600 };
  const samples = [
    hours(day, {
      "01:00": { high: 79800, low: 79000 },
      "02:00": { high: 79700, low: 78000 },
      "03:00": { high: 79600, low: 78900 },
      "04:00": { high: 79500, low: 78800 },
      "05:00": { high: 79400, low: 78950 },
      "06:00": { high: 79300, low: 78940 },
      "07:00": { high: 79200, low: 78700 },
      "08:00": { high: 79100, low: 77900 },
    }),
    hours(day, {
      "01:00": { high: 79000, low: 78400 },
      "02:00": { high: 80000, low: 78600 },
      "03:00": { high: 79800, low: 78700 },
      "04:00": { high: 80100, low: 78800 },
      "07:00": { high: 80200, low: 79000 },
    }),
    hours(day, {
      "01:00": { high: 79800, low: 79000 },
      "02:00": { high: 79700, low: 78500 },
      "03:00": { high: 79600, low: 78600 },
      "04:00": { high: 79500, low: 78400 },
      "07:00": { high: 79200, low: 78300 },
    }),
    [
      ...hours("2026-09-02", {
        "15:00": { high: 80000, low: 79000 },
        "16:00": { high: 79900, low: 78000 },
        "17:00": { high: 80500, low: 79200 },
        "18:00": quiet,
        "19:00": quiet,
      }),
      ...hours("2026-09-03", {
        "01:00": { high: 79800, low: 79000 },
        "02:00": { high: 79700, low: 78500 },
        "03:00": { high: 79600, low: 78600 },
        "04:00": { high: 79500, low: 78700 },
        "05:00": { high: 79400, low: 78800 },
        "06:00": { high: 79300, low: 78750 },
        "07:00": { high: 79350, low: 78700 },
        "08:00": { high: 79200, low: 78400 },
        "14:00": { high: 79400, low: 77900 },
      }),
    ],
  ];
  for (const candles of samples) {
    assertLondonIsFirstTake(candles);
  }
});

test("Лондон не снимает NY через Азию: только предсессия", () => {
  const quiet = { high: 79800, low: 78600 };
  const candles = [
    ...hours("2026-09-02", {
      "15:00": { high: 80000, low: 79000 },
      "16:00": { high: 79900, low: 78000 },
      "17:00": { high: 80500, low: 79200 },
      "18:00": quiet,
      "19:00": quiet,
    }),
    ...hours("2026-09-03", {
      "00:00": quiet,
      "01:00": quiet,
      "02:00": quiet,
      "03:00": quiet,
      "04:00": quiet,
      "05:00": quiet,
      "06:00": quiet,
      "07:00": quiet,
      "08:00": { high: 79400, low: 77900 },
    }),
  ];
  const found = internalsOf(candles);
  assert.equal(
    found.some((item) => item.fromSession === "New York" && item.toSession === "London"),
    false,
  );
});

test("бред: Токио не снимает внутренние NY", () => {
  const quiet = { high: 79800, low: 78600 };
  const candles = [
    ...hours("2026-09-02", {
      "15:00": { high: 80000, low: 79000 },
      "16:00": { high: 79900, low: 78000 },
      "17:00": { high: 80500, low: 79200 },
      "18:00": quiet,
      "19:00": quiet,
    }),
    ...hours("2026-09-03", {
      "00:00": quiet,
      "01:00": { high: 79700, low: 77900 },
      "02:00": quiet,
      "03:00": quiet,
      "04:00": quiet,
      "05:00": quiet,
      "06:00": quiet,
    }),
  ];
  const found = internalsOf(candles);
  assert.equal(
    found.some((item) => item.fromSession === "New York"),
    false,
  );
});

test("бред: NY не снимает внутренние Лондона", () => {
  const quiet = { high: 79800, low: 78600 };
  const candles = hours(day, {
    "07:00": { high: 79800, low: 79000 },
    "08:00": { high: 79900, low: 78000 },
    "09:00": { high: 80500, low: 79200 },
    "10:00": quiet,
    "11:00": quiet,
    "12:00": quiet,
    "13:00": quiet,
    "14:00": { high: 79400, low: 77900 },
    "15:00": quiet,
    "16:00": quiet,
  });
  const found = internalsOf(candles);
  assert.equal(
    found.some((item) => item.fromSession === "London"),
    false,
  );
});

test("внутренние только Tokyo → London", () => {
  const quiet = { high: 79800, low: 78600 };
  const candles = [
    ...hours("2026-09-02", {
      "15:00": { high: 80000, low: 79000 },
      "16:00": { high: 79900, low: 78000 },
      "17:00": { high: 80500, low: 79200 },
      "18:00": quiet,
      "19:00": quiet,
    }),
    ...hours("2026-09-03", {
      "01:00": { high: 79800, low: 79000 },
      "02:00": { high: 79700, low: 78500 },
      "03:00": { high: 79600, low: 78600 },
      "04:00": { high: 79500, low: 78700 },
      "05:00": { high: 79400, low: 78800 },
      "06:00": { high: 79300, low: 78750 },
      "07:00": { high: 79350, low: 78700 },
      "08:00": { high: 79200, low: 78400 },
      "14:00": { high: 79400, low: 77900 },
    }),
  ];
  const found = internalsOf(candles);
  assert.ok(found.length > 0);
  assert.equal(
    found.every((item) => item.fromSession === "Tokyo" && item.toSession === "London"),
    true,
  );
});

function internalsOf(candles: Candle[]) {
  return internal.detect(candles, boxes.detect(candles, SessionHours.chartBoxes(), "1h"), "1h");
}

function assertLondonIsFirstTake(candles: Candle[]): void {
  const sessionBoxes = boxes.detect(candles, SessionHours.chartBoxes(), "1h");
  const found = internal.detect(candles, sessionBoxes, "1h");
  for (const sweep of found) {
    assert.equal(sweep.fromSession, "Tokyo");
    assert.equal(sweep.toSession, "London");
    const take = candles.find((candle) => candle.openTime === sweep.sweepBarTime);
    assert.ok(take);
    const takeHits =
      sweep.side === SweepSide.High ? take.high > sweep.level : take.low < sweep.level;
    assert.equal(takeHits, true);
    for (const candle of candles) {
      if (candle.openTime <= sweep.fromBarTime || candle.openTime >= sweep.sweepBarTime) {
        continue;
      }
      const already =
        sweep.side === SweepSide.High ? candle.high > sweep.level : candle.low < sweep.level;
      assert.equal(already, false);
    }
  }
}

function bar(iso: string, overlay: Partial<CandleDto> = {}): Candle {
  return Candle.from({
    openTime: utc(iso),
    open: overlay.open ?? 77000,
    high: overlay.high ?? 77500,
    low: overlay.low ?? 76800,
    close: overlay.close ?? 77200,
    volume: 1,
  });
}

function hours(date: string, overlay: Record<string, Partial<CandleDto>> = {}): Candle[] {
  const candles: Candle[] = [];
  for (let hour = 0; hour < 20; hour += 1) {
    const openTime = DateTime.fromISO(`${date}T00:00:00Z`, { zone: "utc" })
      .plus({ hours: hour })
      .toMillis();
    const key = DateTime.fromMillis(openTime, { zone: "utc" }).toFormat("HH:mm");
    const marked = overlay[key] ?? {};
    candles.push(
      Candle.from({
        openTime,
        open: marked.open ?? 77000,
        high: marked.high ?? 77500,
        low: marked.low ?? 76800,
        close: marked.close ?? 77200,
        volume: 1,
      }),
    );
  }
  return candles;
}

function utc(iso: string): number {
  return DateTime.fromISO(iso, { zone: "utc" }).toMillis();
}
