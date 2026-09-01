import type { SweepSide } from "./sweep-touch.ts";

export class LiquiditySweep {
  constructor(
    public readonly fromSession: string,
    public readonly toSession: string,
    public readonly side: SweepSide,
    public readonly level: number,
    public readonly fromBarTime: number,
    public readonly sweepBarTime: number,
  ) {}
}
