import assert from "node:assert/strict";
import { test } from "node:test";
import { DateTime } from "luxon";
import type { CandleDto } from "@volium/contracts";
import { SessionEvents } from "../src/domain/session/session-events.ts";
import { LuxonSessionClock } from "../src/infrastructure/time/luxon-session.clock.ts";

const sessionEvents = new SessionEvents(new LuxonSessionClock());

test("лето: London открылась в 07:00 UTC и закрылась в 15:30 UTC", () => {
  const open = sessionEvents.list("BTCUSDT", [], utc("2026-09-02T07:00:00Z"));
  assert.deepEqual(
    open.map((item) => item.text),
    ["London открылась"],
  );
  assert.equal(open[0]?.kind, "open");

  const stillOpen = sessionEvents.list("BTCUSDT", [], utc("2026-09-02T15:29:59Z"));
  assert.equal(stillOpen.some((item) => item.text === "London открылась"), true);
  assert.equal(stillOpen.some((item) => item.text.includes("закрылась")), false);

  const closed = sessionEvents.list("BTCUSDT", [], utc("2026-09-02T15:30:00Z"));
  assert.equal(closed.some((item) => item.text === "London закрылась"), true);
  assert.equal(closed.some((item) => item.text === "New York открылась"), true);
});

test("лето: New York открылась в 13:30 UTC, London ещё открыта", () => {
  const listed = sessionEvents.list("BTCUSDT", [], utc("2026-09-02T13:30:00Z"));
  assert.equal(listed.some((item) => item.text === "New York открылась"), true);
  assert.equal(listed.some((item) => item.text === "London открылась"), true);
  assert.equal(listed.some((item) => item.text.includes("закрылась")), false);
});

test("зима: London 08:00 UTC, New York 14:30 UTC", () => {
  const london = sessionEvents.list("BTCUSDT", [], utc("2026-01-15T08:00:00Z"));
  assert.deepEqual(
    london.map((item) => item.text),
    ["London открылась"],
  );
  const ny = sessionEvents.list("BTCUSDT", [], utc("2026-01-15T14:30:00Z"));
  assert.equal(ny.some((item) => item.text === "New York открылась"), true);
});

test("ETHUSDT без торгового профиля — events пустые", () => {
  assert.deepEqual(sessionEvents.list("ETHUSDT", [], utc("2026-09-02T07:00:00Z")), []);
});

test("снятие хая Азии лондоном висит 6 часов после бара снятия", () => {
  const candles = hours("2026-09-03", {
    "02:00": { high: 77902, low: 77000 },
    "07:00": { open: 77600, high: 78175, low: 77500, close: 77700 },
  });

  const atSweep = sessionEvents.list("BTCUSDT", candles, utc("2026-09-03T07:05:00Z"));
  assert.equal(atSweep.some((item) => item.text === "London открылась"), true);
  const sweep = atSweep.find((item) => item.kind === "liquidity");
  assert.equal(sweep?.text.startsWith("Снятие сессионной ликвидности"), true);
  assert.match(sweep?.text ?? "", /BSL · Tokyo → London/);
  assert.match(sweep?.id ?? "", /^session-liquidity:BTCUSDT:/);

  const almostExpired = sessionEvents.list("BTCUSDT", candles, utc("2026-09-03T12:59:59Z"));
  assert.equal(almostExpired.some((item) => item.kind === "liquidity"), true);

  const expired = sessionEvents.list("BTCUSDT", candles, utc("2026-09-03T13:00:00Z"));
  assert.equal(expired.some((item) => item.kind === "liquidity"), false);
});

test("внутренняя SSL уходит отдельным event", () => {
  const candles = hours("2026-09-02", {
    "01:00": { high: 79800, low: 79000 },
    "02:00": { high: 79700, low: 78500 },
    "03:00": { high: 79600, low: 78600 },
    "04:00": { high: 79500, low: 78700 },
    "05:00": { high: 79400, low: 78800 },
    "06:00": { high: 79300, low: 78750 },
    "07:00": { high: 79350, low: 78700 },
    "08:00": { high: 79200, low: 78400 },
  });
  const listed = sessionEvents.list("BTCUSDT", candles, utc("2026-09-02T08:05:00Z"));
  const inner = listed.find((item) => item.text.startsWith("Снятие внутренней ликвидности"));
  assert.equal(inner?.kind, "liquidity");
  assert.match(inner?.text ?? "", /SSL · Tokyo → London/);
  assert.match(inner?.id ?? "", /^session-liquidity:internal:BTCUSDT:/);
});

function hours(day: string, overlay: Record<string, Partial<CandleDto>> = {}): CandleDto[] {
  const candles: CandleDto[] = [];
  for (let hour = 0; hour < 20; hour += 1) {
    const openTime = DateTime.fromISO(`${day}T00:00:00Z`, { zone: "utc" })
      .plus({ hours: hour })
      .toMillis();
    const key = DateTime.fromMillis(openTime, { zone: "utc" }).toFormat("HH:mm");
    const marked = overlay[key] ?? {};
    candles.push({
      openTime,
      open: marked.open ?? 77000,
      high: marked.high ?? 77500,
      low: marked.low ?? 76800,
      close: marked.close ?? 77200,
      volume: 1,
    });
  }
  return candles;
}

function utc(iso: string): number {
  return DateTime.fromISO(iso, { zone: "utc" }).toMillis();
}
