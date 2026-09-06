import { existsSync } from "node:fs";
import { createCanvas, GlobalFonts, type SKRSContext2D } from "@napi-rs/canvas";
import type { ChartPainterPort, RenderedChart } from "../../application/ports/chart.ports.ts";
import type { Chart } from "../../domain/chart/chart.ts";
import type { Candle } from "../../domain/chart/candle.ts";
import { sessionPoolSweeps } from "../../domain/session/liquidity-sweep.ts";
import { ChartLayout } from "./chart-layout.ts";

const UP = "#089981";
const DOWN = "#f23645";
const GRID = "#d8dbe3";
const AXIS = "#6a6d78";
const TEXT = "#131722";
const SESSION_FILL_ALPHA = 0.22;
const FONT = registerChartFont();

export class CanvasChartPainter implements ChartPainterPort {
  async paint(chart: Chart): Promise<RenderedChart> {
    const { width, height, background, pixelRatio } = chart.look;
    const canvas = createCanvas(Math.round(width * pixelRatio), Math.round(height * pixelRatio));
    const ctx = canvas.getContext("2d");
    ctx.scale(pixelRatio, pixelRatio);
    ctx.imageSmoothingEnabled = false;

    const candles = chart.series;
    const boxes = chart.sessionBoxes;
    const layout = new ChartLayout(
      candles,
      width,
      height,
      chart.interval,
      boxes.map((box) => box.high),
      boxes.map((box) => box.low),
    );
    const snap = createSnap(pixelRatio);

    ctx.fillStyle = background;
    ctx.fillRect(0, 0, width, height);

    this.drawGrid(ctx, layout, width, height, snap);
    this.drawSessionBoxes(ctx, layout, chart, snap);
    this.drawCandles(ctx, layout, candles, pixelRatio);
    this.drawSweeps(ctx, layout, chart, snap);
    this.drawAxes(ctx, layout, width, height, candles, snap);
    this.drawTitle(ctx, chart.name);

    return { bytes: canvas.toBuffer("image/png"), contentType: "image/png" };
  }

  private drawGrid(
    ctx: SKRSContext2D,
    layout: ChartLayout,
    width: number,
    height: number,
    snap: (value: number) => number,
  ): void {
    ctx.strokeStyle = GRID;
    ctx.lineWidth = 1;
    for (const price of layout.priceTicks()) {
      const y = snap(layout.yAt(price));
      ctx.beginPath();
      ctx.moveTo(layout.plotX, y);
      ctx.lineTo(width - 12, y);
      ctx.stroke();
    }

    const cols = 10;
    for (let i = 0; i <= cols; i += 1) {
      const x = snap(layout.plotX + (layout.plotW / cols) * i);
      ctx.beginPath();
      ctx.moveTo(x, layout.plotY);
      ctx.lineTo(x, height - 32);
      ctx.stroke();
    }
  }

  private drawSessionBoxes(
    ctx: SKRSContext2D,
    layout: ChartLayout,
    chart: Chart,
    snap: (value: number) => number,
  ): void {
    ctx.font = `600 15px ${FONT}`;
    for (const box of chart.sessionBoxes) {
      const x1 = snap(layout.barLeft(box.firstBarTime));
      const x2 = snap(layout.barRight(box.lastBarTime));
      const y1 = snap(layout.yAt(box.high));
      const y2 = snap(layout.yAt(box.low));
      const w = Math.max(1, x2 - x1);
      const h = Math.max(1, y2 - y1);

      ctx.globalAlpha = SESSION_FILL_ALPHA;
      ctx.fillStyle = box.color;
      ctx.fillRect(x1, y1, w, h);
      ctx.globalAlpha = 1;

      const label = sessionBoxLabel(ctx, box.title, w);
      if (label == null) {
        continue;
      }

      ctx.fillStyle = box.color;
      ctx.textAlign = "left";
      ctx.textBaseline = "bottom";
      ctx.fillText(label, x1 + 4, Math.max(layout.plotY + 16, y1 - 6));
    }
  }

  private drawSweeps(
    ctx: SKRSContext2D,
    layout: ChartLayout,
    chart: Chart,
    snap: (value: number) => number,
  ): void {
    for (const sweep of sessionPoolSweeps(chart.liquiditySweeps, chart.series.at(-1)?.openTime)) {
      const x1 = snap(layout.barCenter(sweep.fromBarTime));
      const x2 = snap(layout.barCenter(sweep.sweepBarTime));
      const y = snap(layout.yAt(sweep.level));
      if (x2 - x1 < 10) {
        continue;
      }

      const color = sweep.side === "high" ? "#2962ff" : "#ef6c00";
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x1, y);
      ctx.lineTo(x2 - 10, y);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(x2, y);
      ctx.lineTo(x2 - 12, y - 5);
      ctx.lineTo(x2 - 12, y + 5);
      ctx.closePath();
      ctx.fill();

      const midX = snap((x1 + x2) / 2);
      const isBsl = sweep.side === "high";
      ctx.font = `700 13px ${FONT}`;
      ctx.textAlign = "center";
      ctx.fillStyle = color;
      if (isBsl) {
        ctx.textBaseline = "bottom";
        ctx.fillText("BSL", midX, y - 5);
      } else {
        ctx.textBaseline = "top";
        ctx.fillText("SSL", midX, y + 5);
      }
    }
  }

  private drawCandles(
    ctx: SKRSContext2D,
    layout: ChartLayout,
    candles: Candle[],
    pixelRatio: number,
  ): void {
    let bodyW = Math.max(3, Math.floor(layout.slot * pixelRatio * 0.7));
    if (bodyW % 2 === 0) {
      bodyW -= 1;
    }

    for (let i = 0; i < candles.length; i += 1) {
      const candle = candles[i];
      if (candle == null) {
        continue;
      }

      const up = candle.close >= candle.open;
      ctx.fillStyle = up ? UP : DOWN;

      const x = Math.round((layout.candleLeft(i) + layout.slot / 2) * pixelRatio);
      const yHigh = Math.round(layout.yAt(candle.high) * pixelRatio);
      const yLow = Math.round(layout.yAt(candle.low) * pixelRatio);
      const yOpen = Math.round(layout.yAt(candle.open) * pixelRatio);
      const yClose = Math.round(layout.yAt(candle.close) * pixelRatio);

      fillDeviceRect(ctx, pixelRatio, x, yHigh, 1, Math.max(1, yLow - yHigh));

      const top = Math.min(yOpen, yClose);
      const bodyH = Math.max(pixelRatio, Math.abs(yClose - yOpen));
      fillDeviceRect(ctx, pixelRatio, x - Math.floor(bodyW / 2), top, bodyW, bodyH);
    }
  }

  private drawAxes(
    ctx: SKRSContext2D,
    layout: ChartLayout,
    width: number,
    height: number,
    candles: Candle[],
    snap: (value: number) => number,
  ): void {
    ctx.fillStyle = AXIS;
    ctx.font = `12px ${FONT}`;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    const ticks = layout.priceTicks();
    const priceStep = ticks.length >= 2 ? Math.abs((ticks[1] ?? 0) - (ticks[0] ?? 0)) : 1;
    for (const price of ticks) {
      ctx.fillText(formatPrice(price, priceStep), width - 100, snap(layout.yAt(price)));
    }

    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    const timeStep = Math.max(1, Math.floor(candles.length / 7));
    for (let i = 0; i < candles.length; i += timeStep) {
      const candle = candles[i];
      if (candle == null) {
        continue;
      }

      const x = snap(layout.candleLeft(i) + layout.slot / 2);
      ctx.fillText(formatTime(candle.openTime), x, height - 34);
    }

    this.drawLastPrice(ctx, layout, width, candles, priceStep, snap);
  }

  private drawLastPrice(
    ctx: SKRSContext2D,
    layout: ChartLayout,
    width: number,
    candles: Candle[],
    priceStep: number,
    snap: (value: number) => number,
  ): void {
    const last = candles[candles.length - 1];
    if (last == null) {
      return;
    }

    const y = snap(layout.yAt(last.close));
    const up = last.close >= last.open;
    const label = formatPrice(last.close, priceStep);
    const boxH = 20;
    const boxX = width - 104;
    const boxW = 96;
    ctx.fillStyle = up ? UP : DOWN;
    ctx.fillRect(boxX, y - boxH / 2, boxW, boxH);
    ctx.fillStyle = "#ffffff";
    ctx.font = `600 12px ${FONT}`;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(label, width - 100, y);
  }

  private drawTitle(ctx: SKRSContext2D, title: string): void {
    ctx.fillStyle = TEXT;
    ctx.font = `600 18px ${FONT}`;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(title, 24, 14);
  }
}

function fillDeviceRect(
  ctx: SKRSContext2D,
  pixelRatio: number,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  ctx.fillRect(x / pixelRatio, y / pixelRatio, w / pixelRatio, h / pixelRatio);
}

function createSnap(pixelRatio: number): (value: number) => number {
  return (value: number) => Math.round(value * pixelRatio) / pixelRatio;
}

function sessionBoxLabel(ctx: SKRSContext2D, title: string, boxWidth: number): string | null {
  const pad = 8;
  const short =
    title === "New York" ? "NY" : title === "pre-London" ? "pre-L" : title;
  if (ctx.measureText(title).width + pad <= boxWidth) {
    return title;
  }
  if (ctx.measureText(short).width + pad <= boxWidth || boxWidth >= 20) {
    return short;
  }
  return null;
}

function registerChartFont(): string {
  const files = [
    { path: "C:/Windows/Fonts/segoeui.ttf", family: "Segoe UI" },
    { path: "C:/Windows/Fonts/arial.ttf", family: "Arial" },
    { path: "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", family: "DejaVu Sans" },
  ];

  for (const file of files) {
    if (!existsSync(file.path)) {
      continue;
    }

    GlobalFonts.registerFromPath(file.path, file.family);
    return `"${file.family}"`;
  }

  return "sans-serif";
}

function formatPrice(price: number, step: number): string {
  const fromStep =
    Number.isFinite(step) && step > 0 ? Math.max(0, Math.ceil(-Math.log10(step) - 1e-12)) : 2;
  const decimals =
    price >= 1000 ? Math.max(fromStep, 2) : price >= 1 ? Math.max(fromStep, 4) : Math.max(fromStep, 5);
  return price.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function formatTime(utcMs: number): string {
  const date = new Date(utcMs);
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  const hours = String(date.getUTCHours()).padStart(2, "0");
  const minutes = String(date.getUTCMinutes()).padStart(2, "0");
  return `${day}.${month} ${hours}:${minutes}`;
}
