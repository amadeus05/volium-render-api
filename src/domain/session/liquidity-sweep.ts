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

export function sessionSweepNotice(sweep: LiquiditySweep): string {
  const kind = sweep.side === "high" ? "BSL" : "SSL";
  const edge = sweep.side === "high" ? "хай" : "лой";
  const when = new Date(sweep.sweepBarTime).toISOString().slice(0, 16);
  return [
    "Снятие сессионной ликвидности",
    `${kind} · ${sweep.fromSession} → ${sweep.toSession}`,
    `снят ${edge} ${sweep.level} на ${when} UTC`,
  ].join("\n");
}
