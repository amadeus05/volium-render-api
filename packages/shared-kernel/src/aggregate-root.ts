import { Entity } from "./entity.ts";
import type { DomainEvent } from "./domain-event.ts";

export abstract class AggregateRoot<TId> extends Entity<TId> {
  private readonly pendingEvents: DomainEvent[] = [];

  protected record(event: DomainEvent): void {
    this.pendingEvents.push(event);
  }

  pullEvents(): DomainEvent[] {
    return this.pendingEvents.splice(0);
  }
}
