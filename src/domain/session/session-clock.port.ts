export type LocalYmd = {
  year: number;
  month: number;
  day: number;
};

export interface SessionClockPort {
  localYmd(utcMs: number, timeZone: string): LocalYmd;
  at(
    timeZone: string,
    year: number,
    month: number,
    day: number,
    hour: number,
    minute: number,
  ): number;
}
