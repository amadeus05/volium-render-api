import assert from "node:assert/strict";
import { test } from "node:test";
import { DateTime } from "luxon";
import type { CandleDto } from "@volium/contracts";
import { ListSessionEventsUseCase } from "../src/application/use-cases/list-session-events.use-case.ts";
import { SessionNotices } from "../src/domain/session/session-notices.ts";
import { parseEventsQuery } from "../src/infrastructure/market-data/parse-events-query.ts";
import { LuxonSessionClock } from "../src/infrastructure/time/luxon-session.clock.ts";

test("query: klines-поля плюс now", () => {
  const parsed = parseEventsQuery(
    new URL("https://x/events?exchange=bybit&symbol=BTCUSDT&timeframe=1h&limit=80&now=1788422700000"),
  );
  assert.deepEqual(parsed, {
    exchange: "bybit",
    symbol: "BTCUSDT",
    timeframe: "1h",
    limit: 80,
    now: 1788422700000,
  });
});

test("query: без now — текущие миллисекунды", () => {
  const before = Date.now();
  const parsed = parseEventsQuery(
    new URL("https://x/events?exchange=binance&symbol=BTCUSDT&timeframe=1h"),
  );
  const after = Date.now();
  assert.equal(parsed.limit, 144);
  assert.ok(parsed.now >= before && parsed.now <= after);
});

test("query: мусорный now — ошибка", () => {
  assert.throws(
    () => parseEventsQuery(new URL("https://x/events?exchange=bybit&symbol=BTCUSDT&timeframe=1h&now=nope")),
    /events: нужен now/,
  );
});

test("открытие без снятия — imageUrl нет, PNG не рисуем", async () => {
  let paints = 0;
  const payload = await new ListSessionEventsUseCase(
    new SessionNotices(new LuxonSessionClock()),
    {
      execute: async () => {
        paints += 1;
        return { requestId: "x", imageUrl: "https://img/x.png", contentType: "image/png" };
      },
    },
    async () => [],
  ).execute({
    exchange: "bybit",
    symbol: "BTCUSDT",
    timeframe: "1h",
    limit: 144,
    now: utc("2026-09-02T07:00:00Z"),
  });

  assert.equal(payload.imageUrl, null);
  assert.equal(payload.notices.some((item) => item.kind === "open"), true);
  assert.equal(paints, 0);
  assert.equal("candles" in payload, false);
});

test("снятие — сразу PNG в ответе, свечи воркеру не отдаём", async () => {
  const candles = hours("2026-09-03", {
    "02:00": { high: 77902, low: 77000 },
    "07:00": { open: 77600, high: 78175, low: 77500, close: 77700 },
  });
  let seen = 0;
  const payload = await new ListSessionEventsUseCase(
    new SessionNotices(new LuxonSessionClock()),
    {
      execute: async (request) => {
        seen += 1;
        assert.equal(request.layers?.sweeps, true);
        assert.equal(request.candles, candles);
        return { requestId: request.requestId, imageUrl: "https://img/1h.png", contentType: "image/png" };
      },
    },
    async () => candles,
  ).execute({
    exchange: "bybit",
    symbol: "BTCUSDT",
    timeframe: "1h",
    limit: 144,
    now: utc("2026-09-03T07:05:00Z"),
  });

  assert.equal(seen, 1);
  assert.equal(payload.imageUrl, "https://img/1h.png");
  assert.equal(payload.notices.some((item) => item.kind === "liquidity"), true);
});

test("PNG не собрался — notices всё равно в ответе, imageUrl null", async () => {
  const candles = hours("2026-09-03", {
    "02:00": { high: 77902, low: 77000 },
    "07:00": { open: 77600, high: 78175, low: 77500, close: 77700 },
  });
  const payload = await new ListSessionEventsUseCase(
    new SessionNotices(new LuxonSessionClock()),
    {
      execute: async () => {
        throw new Error("paint failed");
      },
    },
    async () => candles,
  ).execute({
    exchange: "bybit",
    symbol: "BTCUSDT",
    timeframe: "1h",
    limit: 144,
    now: utc("2026-09-03T07:05:00Z"),
  });

  assert.equal(payload.imageUrl, null);
  assert.equal(payload.notices.some((item) => item.kind === "liquidity"), true);
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
