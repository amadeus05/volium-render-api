export class Result<T, E = Error> {
  private constructor(
    private readonly okValue: T | undefined,
    private readonly errValue: E | undefined,
    public readonly isOk: boolean,
  ) {}

  static ok<T>(value: T): Result<T, never> {
    return new Result(value, undefined as never, true);
  }

  static fail<E>(error: E): Result<never, E> {
    return new Result(undefined as never, error, false);
  }

  get value(): T {
    if (!this.isOk) {
      throw new Error("Tried to unwrap a failed Result");
    }

    return this.okValue as T;
  }

  get error(): E {
    if (this.isOk) {
      throw new Error("Tried to read error from a successful Result");
    }

    return this.errValue as E;
  }
}
