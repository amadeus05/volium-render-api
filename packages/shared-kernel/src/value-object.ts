export abstract class ValueObject<TProps extends object> {
  protected constructor(protected readonly props: Readonly<TProps>) {}

  equals(other: ValueObject<TProps> | null | undefined): boolean {
    if (other == null || this.constructor !== other.constructor) {
      return false;
    }

    return JSON.stringify(this.props) === JSON.stringify(other.props);
  }
}
