import { ValueObject } from "@volium/shared-kernel";

type Props = {
  openTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export class Candle extends ValueObject<Props> {
  private constructor(props: Props) {
    super(props);
  }

  static from(props: Props): Candle {
    return new Candle(props);
  }

  get openTime(): number {
    return this.props.openTime;
  }

  get open(): number {
    return this.props.open;
  }

  get high(): number {
    return this.props.high;
  }

  get low(): number {
    return this.props.low;
  }

  get close(): number {
    return this.props.close;
  }

  get volume(): number {
    return this.props.volume;
  }
}
