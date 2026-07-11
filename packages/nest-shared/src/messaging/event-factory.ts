import { v7 as uuidv7 } from 'uuid';
import type { DomainEvent } from '@lilochat/contracts';

/**
 * Builds a domain event envelope (CLAUDE.md §6.1). uuid v7 is time-ordered —
 * nice for outbox scans and log correlation — and is the consumer idempotency key.
 */
export function makeDomainEvent<TPayload>(
  name: string,
  payload: TPayload,
  now: Date = new Date(),
): DomainEvent<TPayload> {
  return {
    eventId: uuidv7(),
    name,
    occurredAt: now.toISOString(),
    version: 1,
    payload,
  };
}
