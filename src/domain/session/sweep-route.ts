import { ValueObject } from "@volium/shared-kernel";
import { SweepSide, SweepTouch } from "./sweep-touch.ts";

type Props = {
  from: string;
  to: string[];
  touch: SweepTouch[];
  sides: SweepSide[];
};

export class SweepRoute extends ValueObject<Props> {
  private constructor(props: Props) {
    super(props);
  }

  static from(session: string): SweepRoute {
    return new SweepRoute({
      from: session,
      to: [],
      touch: [SweepTouch.Wick],
      sides: [SweepSide.High, SweepSide.Low],
    });
  }

  to(...sessions: string[]): SweepRoute {
    return new SweepRoute({ ...this.props, to: sessions });
  }

  via(...touch: SweepTouch[]): SweepRoute {
    return new SweepRoute({
      ...this.props,
      touch: touch.length === 0 ? [SweepTouch.Wick] : touch,
    });
  }

  ofSides(...sides: SweepSide[]): SweepRoute {
    return new SweepRoute({
      ...this.props,
      sides: sides.length === 0 ? [SweepSide.High, SweepSide.Low] : sides,
    });
  }

  get source(): string {
    return this.props.from;
  }

  get targets(): string[] {
    return this.props.to;
  }

  get touch(): SweepTouch[] {
    return this.props.touch;
  }

  get sides(): SweepSide[] {
    return this.props.sides;
  }
}
