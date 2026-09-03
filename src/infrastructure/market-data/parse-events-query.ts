import type { KlinesQuery } from "./parse-klines-query.ts";
import { parseKlinesQuery } from "./parse-klines-query.ts";

export type EventsQuery = KlinesQuery & {
  now: number;
};

export function parseEventsQuery(url: URL): EventsQuery {
  const klines = parseKlinesQuery(url);
  const nowRaw = url.searchParams.get("now")?.trim() ?? "";
  const now = nowRaw === "" ? Date.now() : Number(nowRaw);
  if (!Number.isInteger(now) || now < 0) {
    throw new Error("events: нужен now");
  }

  return { ...klines, now };
}
