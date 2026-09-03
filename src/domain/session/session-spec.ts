import { ValueObject } from "@volium/shared-kernel";
import type { SessionClock } from "./session-clock.ts";

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

  bounds(clock: SessionClock, utcMs: number): { start: number; end: number } {
    const ymd = clock.localYmd(utcMs, this.timeZone);
    return {
      start: clock.at(
        this.timeZone,
        ymd.year,
        ymd.month,
        ymd.day,
        this.startHour,
        this.startMinute,
      ),
      end: clock.at(
        this.timeZone,
        ymd.year,
        ymd.month,
        ymd.day,
        this.endHour,
        this.endMinute,
      ),
    };
  }
}
