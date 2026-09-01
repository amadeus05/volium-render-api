export type LocalYmd = {
  year: number;
  month: number;
  day: number;
};

export interface SessionClock {
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
