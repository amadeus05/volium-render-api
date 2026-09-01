export class SessionBox {
  constructor(
    public readonly title: string,
    public readonly color: string,
    public readonly winStart: number,
    public readonly lastBarTime: number,
    public readonly high: number,
    public readonly low: number,
    public readonly highTime: number,
    public readonly lowTime: number,
  ) {}
}
