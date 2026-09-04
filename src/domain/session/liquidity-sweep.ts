import type { SweepSide } from "./sweep-touch.ts";

export type LiquidityPool = "session" | "internal";

export class LiquiditySweep {
  constructor(
    public readonly fromSession: string,
    public readonly toSession: string,
    public readonly side: SweepSide,
    public readonly level: number,
    public readonly fromBarTime: number,
    public readonly sweepBarTime: number,
    public readonly pool: LiquidityPool = "session",
  ) {}
}

export function sessionSweepNotice(sweep: LiquiditySweep): string {
  const kind = sweep.side === "high" ? "BSL" : "SSL";
  const edge = sweep.side === "high" ? "хай" : "лой";
  const when = new Date(sweep.sweepBarTime).toISOString().slice(0, 16);
  const route =
    sweep.fromSession === sweep.toSession
      ? `${kind} · ${sweep.fromSession}`
      : `${kind} · ${sweep.fromSession} → ${sweep.toSession}`;
  return [
    sweep.pool === "internal" ? "Снятие внутренней ликвидности" : "Снятие сессионной ликвидности",
    route,
    `снят ${edge} ${sweep.level} на ${when} UTC`,
  ].join("\n");
}
