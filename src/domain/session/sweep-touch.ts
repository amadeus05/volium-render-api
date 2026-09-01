export const SweepTouch = {
  Wick: "wick",
  Body: "body",
} as const;

export type SweepTouch = (typeof SweepTouch)[keyof typeof SweepTouch];

export const SweepSide = {
  High: "high",
  Low: "low",
} as const;

export type SweepSide = (typeof SweepSide)[keyof typeof SweepSide];
