import {
  MAX_RENDER_CANDLES,
  isChartTimeframe,
  type CandleDto,
  type ChartLayers,
  type RenderChartRequest,
} from "@volium/contracts";
import { Result } from "@volium/shared-kernel";

export class RenderRequestError {
  constructor(
    readonly status: 400 | 413,
    readonly message: string,
  ) {}
}

export function parseRenderChartRequest(raw: string): Result<RenderChartRequest, RenderRequestError> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    return Result.fail(new RenderRequestError(400, "invalid json"));
  }

  if (parsed == null || typeof parsed !== "object" || Array.isArray(parsed)) {
    return Result.fail(new RenderRequestError(400, "body must be an object"));
  }

  const body = parsed as Record<string, unknown>;
  const requestId = readNonEmptyString(body.requestId);
  const symbol = readNonEmptyString(body.symbol);
  if (requestId == null || symbol == null) {
    return Result.fail(new RenderRequestError(400, "requestId and symbol are required"));
  }

  if (typeof body.timeframe !== "string" || !isChartTimeframe(body.timeframe)) {
    return Result.fail(new RenderRequestError(400, "unknown timeframe"));
  }

  const candles = parseCandles(body.candles);
  if (candles instanceof RenderRequestError) {
    return Result.fail(candles);
  }

  const layers = parseLayers(body.layers);
  if (layers instanceof RenderRequestError) {
    return Result.fail(layers);
  }

  const request: RenderChartRequest = {
    requestId,
    symbol,
    timeframe: body.timeframe,
    candles,
  };

  if (typeof body.title === "string" && body.title.trim() !== "") {
    request.title = body.title.trim();
  }

  if (layers != null) {
    request.layers = layers;
  }

  return Result.ok(request);
}

function parseCandles(raw: unknown): CandleDto[] | RenderRequestError {
  if (!Array.isArray(raw) || raw.length === 0) {
    return new RenderRequestError(400, "candles must be a non-empty array");
  }

  if (raw.length > MAX_RENDER_CANDLES) {
    return new RenderRequestError(413, `too many candles, max ${MAX_RENDER_CANDLES}`);
  }

  const candles: CandleDto[] = [];
  for (const item of raw) {
    const candle = parseCandle(item);
    if (candle instanceof RenderRequestError) {
      return candle;
    }

    candles.push(candle);
  }

  return candles;
}

function parseCandle(raw: unknown): CandleDto | RenderRequestError {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) {
    return new RenderRequestError(400, "candle must be an object");
  }

  const row = raw as Record<string, unknown>;
  const openTime = readFiniteNumber(row.openTime);
  const open = readFiniteNumber(row.open);
  const high = readFiniteNumber(row.high);
  const low = readFiniteNumber(row.low);
  const close = readFiniteNumber(row.close);
  const volume = readFiniteNumber(row.volume);
  if (openTime == null || open == null || high == null || low == null || close == null || volume == null) {
    return new RenderRequestError(400, "candle fields must be finite numbers");
  }

  return { openTime, open, high, low, close, volume };
}

function parseLayers(raw: unknown): ChartLayers | undefined | RenderRequestError {
  if (raw == null) {
    return undefined;
  }

  if (typeof raw !== "object" || Array.isArray(raw)) {
    return new RenderRequestError(400, "layers must be an object");
  }

  const row = raw as Record<string, unknown>;
  const layers: ChartLayers = {};
  if ("sessions" in row) {
    if (typeof row.sessions !== "boolean") {
      return new RenderRequestError(400, "layers.sessions must be boolean");
    }

    layers.sessions = row.sessions;
  }

  if ("sweeps" in row) {
    if (typeof row.sweeps !== "boolean") {
      return new RenderRequestError(400, "layers.sweeps must be boolean");
    }

    layers.sweeps = row.sweeps;
  }

  return layers;
}

function readNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

function readFiniteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
