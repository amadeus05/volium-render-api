import assert from "node:assert/strict";
import { test } from "node:test";
import { DateTime } from "luxon";
import type { CandleDto } from "@volium/contracts";
import { Candle } from "../src/domain/chart/candle.ts";
import { DetectLiquiditySweeps } from "../src/domain/session/detect-liquidity-sweeps.ts";
import { DetectSessionBoxes } from "../src/domain/session/detect-session-boxes.ts";
import { SessionSpec } from "../src/domain/session/session-spec.ts";
import { SweepRoute } from "../src/domain/session/sweep-route.ts";
import { SweepSide, SweepTouch } from "../src/domain/session/sweep-touch.ts";
import { VoliumSessions } from "../src/domain/session/volium-sessions.ts";
import { VoliumSweeps } from "../src/domain/session/volium-sweeps.ts";
import { LuxonSessionClock } from "../src/infrastructure/time/luxon-session.clock.ts";

const boxes = new DetectSessionBoxes(new LuxonSessionClock());
const sweeps = new DetectLiquiditySweeps();
const day = "2026-09-02";

test("1d — коробок нет", () => {
  assert.deepEqual(boxes.detect(hours(day), VoliumSessions.all(), "1d"), []);
});

test("лето: London 07:00–15:00 UTC, хай/лой окна", () => {
  const candles = [
    bar(`${day}T07:00:00Z`, { high: 77100, low: 76900 }),
    bar(`${day}T10:00:00Z`, { high: 78000, low: 77000 }),
    bar(`${day}T15:00:00Z`, { high: 77500, low: 76800 }),
  ];
  const found = boxes.detect(candles, [VoliumSessions.london()], "1h");
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
    boxes.detect(candles, VoliumSessions.chartBoxes(), "1h"),
    VoliumSweeps.default(),
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
    boxes.detect(candles, VoliumSessions.chartBoxes(), "1h"),
    VoliumSweeps.default(),
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
    boxes.detect(candles, VoliumSessions.chartBoxes(), "1h"),
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
    boxes.detect(candles, VoliumSessions.chartBoxes(), "1h"),
    VoliumSweeps.default(),
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
    boxes.detect(candles, VoliumSessions.chartBoxes(), "1h"),
    VoliumSweeps.default(),
  );
  assert.deepEqual(found, []);
});

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
