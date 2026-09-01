import { ValueObject } from "@volium/shared-kernel";

type Props = { value: string };

export class ChartId extends ValueObject<Props> {
  private constructor(props: Props) {
    super(props);
  }

  static from(raw: string): ChartId {
    return new ChartId({ value: raw });
  }

  toString(): string {
    return this.props.value;
  }
}
