import { AggregateRoot } from "@volium/shared-kernel";
import type { ChartTimeframe } from "@volium/contracts";
import type { Candle } from "./candle.ts";
import { ChartId } from "./chart-id.ts";
import type { ChartStyle } from "./chart-style.ts";
import type { LiquiditySweep } from "../session/liquidity-sweep.ts";
import type { SessionBox } from "../session/session-box.ts";

export class Chart extends AggregateRoot<ChartId> {
  private constructor(
    id: ChartId,
    private readonly title: string,
    private readonly candles: Candle[],
    private readonly style: ChartStyle,
    private readonly timeframe: ChartTimeframe,
    private readonly boxes: SessionBox[],
    private readonly sweeps: LiquiditySweep[],
  ) {
    super(id);
  }

  static compose(
    requestId: string,
    title: string,
    candles: Candle[],
    style: ChartStyle,
    timeframe: ChartTimeframe,
    boxes: SessionBox[],
    sweeps: LiquiditySweep[] = [],
  ): Chart {
    return new Chart(ChartId.from(requestId), title, candles, style, timeframe, boxes, sweeps);
  }

  get name(): string {
    return this.title;
  }

  get series(): Candle[] {
    return this.candles;
  }

  get look(): ChartStyle {
    return this.style;
  }

  get interval(): ChartTimeframe {
    return this.timeframe;
  }

  get sessionBoxes(): SessionBox[] {
    return this.boxes;
  }

  get liquiditySweeps(): LiquiditySweep[] {
    return this.sweeps;
  }
}
