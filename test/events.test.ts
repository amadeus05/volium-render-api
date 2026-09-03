import assert from "node:assert/strict";
import { test } from "node:test";
import { parseEventsQuery } from "../src/infrastructure/market-data/parse-events-query.ts";

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
