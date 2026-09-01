import { ValueObject } from "@volium/shared-kernel";

type Props = {
  width: number;
  height: number;
  background: string;
  pixelRatio: number;
};

export class ChartStyle extends ValueObject<Props> {
  private constructor(props: Props) {
    super(props);
  }

  static default(): ChartStyle {
    return new ChartStyle({
      width: 1920,
      height: 1080,
      background: "#ffffff",
      pixelRatio: 2,
    });
  }

  get width(): number {
    return this.props.width;
  }

  get height(): number {
    return this.props.height;
  }

  get background(): string {
    return this.props.background;
  }

  get pixelRatio(): number {
    return this.props.pixelRatio;
  }
}
