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

/**
 * На графике: сессионный пул всегда (хай/лой коробки).
 * Внутреннюю качель — только если сняла текущая свеча.
 * На сессию не больше одной стрелки сверху и одной снизу: самый высокий BSL / самый низкий SSL.
 */
export function sessionPoolSweeps(sweeps: LiquiditySweep[], lastBarTime?: number): LiquiditySweep[] {
  const visible = sweeps.filter((sweep) => {
    if (sweep.pool === "session") {
      return true;
    }
    return lastBarTime != null && sweep.sweepBarTime === lastBarTime;
  });

  const extreme = new Map<string, LiquiditySweep>();
  for (const sweep of visible) {
    const key = `${sweep.fromSession}:${sweep.side}`;
    const current = extreme.get(key);
    if (current == null || moreExtreme(sweep, current)) {
      extreme.set(key, sweep);
    }
  }

  const keep = new Set(extreme.values());
  return visible.filter((sweep) => keep.has(sweep));
}

function moreExtreme(candidate: LiquiditySweep, current: LiquiditySweep): boolean {
  return candidate.side === "high" ? candidate.level > current.level : candidate.level < current.level;
}

export function sessionSweepText(sweep: LiquiditySweep): string {
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
