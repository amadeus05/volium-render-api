import { ValueObject } from "@volium/shared-kernel";

type Props = {
  enabled: boolean;
  title: string;
  timeZone: string;
  startHour: number;
  startMinute: number;
  endHour: number;
  endMinute: number;
  color: string;
};

export class SessionSpec extends ValueObject<Props> {
  private constructor(props: Props) {
    super(props);
  }

  static define(props: Props): SessionSpec {
    return new SessionSpec(props);
  }

  get enabled(): boolean {
    return this.props.enabled;
  }

  get title(): string {
    return this.props.title;
  }

  get timeZone(): string {
    return this.props.timeZone;
  }

  get startHour(): number {
    return this.props.startHour;
  }

  get startMinute(): number {
    return this.props.startMinute;
  }

  get endHour(): number {
    return this.props.endHour;
  }

  get endMinute(): number {
    return this.props.endMinute;
  }

  get color(): string {
    return this.props.color;
  }
}
