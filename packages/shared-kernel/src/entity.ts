export abstract class Entity<TId> {
  protected constructor(public readonly id: TId) {}

  equals(other: Entity<TId> | null | undefined): boolean {
    if (other == null || this.constructor !== other.constructor) {
      return false;
    }

    return this.id === other.id;
  }
}
