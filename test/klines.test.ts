import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { parseKlinesQuery } from "../src/infrastructure/market-data/parse-klines-query.ts";
import { BybitMarketData } from "../src/infrastructure/market-data/bybit-market-data.ts";
import { BinanceMarketData } from "../src/infrastructure/market-data/binance-market-data.ts";
import { klineFeed } from "../src/infrastructure/market-data/kline-feed.ts";

const realFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = realFetch;
});

test("query: биржа, символ, таймфрейм, limit", () => {
  const parsed = parseKlinesQuery(
    new URL("https://x/klines?exchange=bybit&symbol=BTCUSDT&timeframe=1h&limit=80"),
  );
  assert.deepEqual(parsed, {
    exchange: "bybit",
    symbol: "BTCUSDT",
    timeframe: "1h",
    limit: 80,
  });
});

test("query: limit по умолчанию 144, потолок 400", () => {
  const def = parseKlinesQuery(new URL("https://x/klines?exchange=binance&symbol=BTCUSDT&timeframe=5m"));
  assert.equal(def.exchange, "binance");
  assert.equal(def.limit, 144);

  const capped = parseKlinesQuery(
    new URL("https://x/klines?exchange=bybit&symbol=ETHUSDT&timeframe=1h&limit=999"),
  );
  assert.equal(capped.limit, 400);
});

test("query: неизвестная биржа и мусор — ошибка", () => {
  assert.throws(() => parseKlinesQuery(new URL("https://x/klines?exchange=okx&symbol=BTCUSDT&timeframe=1h")));
  assert.throws(() => parseKlinesQuery(new URL("https://x/klines?exchange=bybit&symbol=btc&timeframe=1h")));
  assert.throws(() => parseKlinesQuery(new URL("https://x/klines?exchange=bybit&symbol=BTCUSDT&timeframe=2h")));
  assert.throws(() => parseKlinesQuery(new URL("https://x/klines?exchange=bybit&symbol=BTCUSDT&timeframe=1h&limit=0")));
});

test("klineFeed отдаёт binance или bybit", () => {
  assert.equal(klineFeed("binance") instanceof BinanceMarketData, true);
  assert.equal(klineFeed("bybit") instanceof BybitMarketData, true);
});

test("Bybit: список с новых к старым, limit уходит в URL", async () => {
  const seen: string[] = [];
  globalThis.fetch = (async (input: string | URL | Request) => {
    seen.push(String(input));
    return Response.json({
      retCode: 0,
      retMsg: "OK",
      result: {
        list: [
          ["1788422400000", "77600", "78175", "77500", "77700", "12", "12"],
          ["1788404400000", "77000", "77902", "76800", "77100", "9", "9"],
        ],
      },
    });
  }) as typeof fetch;

  const candles = await new BybitMarketData().load("BTCUSDT", "1h", 80);
  assert.match(seen[0] ?? "", /api\.bybit\.com\/v5\/market\/kline/);
  assert.match(seen[0] ?? "", /interval=60/);
  assert.match(seen[0] ?? "", /limit=80/);
  assert.deepEqual(
    candles.map((candle) => candle.openTime),
    [1788404400000, 1788422400000],
  );
  assert.equal(candles[0]?.high, 77902);
});

test("Binance: OHLC как в kline, limit в URL", async () => {
  const seen: string[] = [];
  globalThis.fetch = (async (input: string | URL | Request) => {
    seen.push(String(input));
    return Response.json([
      [1788404400000, "77000", "77902", "76800", "77100", "9"],
      [1788422400000, "77600", "78175", "77500", "77700", "12"],
    ]);
  }) as typeof fetch;

  const candles = await new BinanceMarketData().load("BTCUSDT", "1h", 144);
  assert.match(seen[0] ?? "", /api\.binance\.com\/api\/v3\/klines/);
  assert.match(seen[0] ?? "", /interval=1h/);
  assert.match(seen[0] ?? "", /limit=144/);
  assert.equal(candles[1]?.high, 78175);
  assert.equal(candles.length, 2);
});

test("пустой ответ биржи — ошибка", async () => {
  globalThis.fetch = (async () => Response.json({ retCode: 0, result: { list: [] } })) as typeof fetch;
  await assert.rejects(() => new BybitMarketData().load("BTCUSDT", "1h", 10), /пустой kline/);

  globalThis.fetch = (async () => Response.json([])) as typeof fetch;
  await assert.rejects(() => new BinanceMarketData().load("BTCUSDT", "1h", 10), /пустой kline/);
});
