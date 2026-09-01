import { TIMEFRAME_MS } from "@volium/contracts";
import type { ChartTimeframe } from "@volium/contracts";
import type { Candle } from "../../domain/chart/candle.ts";

export class ChartLayout {
  readonly plotX: number;
  readonly plotY: number;
  readonly plotW: number;
  readonly plotH: number;
  readonly minPrice: number;
  readonly maxPrice: number;
  readonly slot: number;
  readonly barMs: number;

  constructor(
    private readonly candles: Candle[],
    width: number,
    height: number,
    timeframe: ChartTimeframe,
    extraHighs: number[],
    extraLows: number[],
  ) {
    this.plotX = 24;
    this.plotY = 52;
    this.plotW = width - 24 - 108;
    this.plotH = height - 52 - 48;
    this.barMs = TIMEFRAME_MS[timeframe];
    this.slot = candles.length === 0 ? this.plotW : this.plotW / candles.length;

    const highs = [...candles.map((c) => c.high), ...extraHighs];
    const lows = [...candles.map((c) => c.low), ...extraLows];
    const rawMin = lows.length === 0 ? 0 : Math.min(...lows);
    const rawMax = highs.length === 0 ? 1 : Math.max(...highs);
    const pad = (rawMax - rawMin) * 0.04 || rawMax * 0.01;
    this.minPrice = rawMin - pad;
    this.maxPrice = rawMax + pad;
  }

  xAt(utcMs: number): number {
    const candles = this.candles;
    if (candles.length === 0) {
      return this.plotX;
    }

    const first = candles[0];
    const last = candles[candles.length - 1];
    if (first == null || last == null) {
      return this.plotX;
    }

    if (utcMs <= first.openTime) {
      const span = this.barOpenSpan(0);
      const frac = span === 0 ? 0 : (utcMs - first.openTime) / span;
      return this.plotX + frac * this.slot;
    }

    let i = candles.length - 1;
    for (let idx = 0; idx < candles.length; idx += 1) {
      const current = candles[idx];
      const next = candles[idx + 1];
      if (current == null) {
        continue;
      }

      const end = next?.openTime ?? current.openTime + this.barMs;
      if (utcMs < end || idx === candles.length - 1) {
        i = idx;
        break;
      }
    }

    const bar = candles[i];
    if (bar == null) {
      return this.plotX;
    }

    const span = this.barOpenSpan(i);
    const frac = span === 0 ? 0 : Math.max(0, Math.min(1, (utcMs - bar.openTime) / span));
    return this.plotX + (i + frac) * this.slot;
  }

  yAt(price: number): number {
    const range = this.maxPrice - this.minPrice || 1;
    return this.plotY + ((this.maxPrice - price) / range) * this.plotH;
  }

  candleLeft(index: number): number {
    return this.plotX + index * this.slot;
  }

  priceTicks(minSpacingPx = 24): number[] {
    const range = this.maxPrice - this.minPrice;
    if (range <= 0) {
      return [this.minPrice];
    }

    const maxTicks = Math.max(10, Math.floor(this.plotH / minSpacingPx));
    const step = nicePriceStep(range / maxTicks);
    const first = Math.ceil(this.minPrice / step) * step;
    const ticks: number[] = [];
    const cap = this.maxPrice + step * 0.0001;

    for (let price = first; price <= cap; price = roundTick(price + step, step)) {
      if (price >= this.minPrice && price <= this.maxPrice) {
        ticks.push(price);
      }
    }

    return ticks;
  }

  private barOpenSpan(index: number): number {
    const bar = this.candles[index];
    const next = this.candles[index + 1];
    if (bar == null) {
      return this.barMs;
    }

    return (next?.openTime ?? bar.openTime + this.barMs) - bar.openTime;
  }
}

function nicePriceStep(rough: number): number {
  if (!Number.isFinite(rough) || rough <= 0) {
    return 1;
  }

  const exp = Math.floor(Math.log10(rough));
  const base = 10 ** exp;
  const frac = rough / base;
  const nice = frac <= 1 ? 1 : frac <= 2 ? 2 : frac <= 2.5 ? 2.5 : frac <= 5.5 ? 5 : 10;
  return nice * base;
}

function roundTick(value: number, step: number): number {
  const decimals = Math.max(0, Math.ceil(-Math.log10(step) + 2));
  return Number(value.toFixed(decimals));
}
