import { z } from 'zod';

/**
 * Every domain event on the bus is wrapped in this envelope.
 * `eventId` (uuid v7) is the consumer idempotency key — see CLAUDE.md §6.1.
 */
export interface DomainEvent<TPayload> {
  eventId: string;
  name: string;
  occurredAt: string; // ISO 8601, server clock
  version: 1;
  payload: TPayload;
}

/** Builds the zod schema for a concrete event: name literal + typed payload. */
export function domainEventSchema<TName extends string, TPayload extends z.ZodTypeAny>(
  name: TName,
  payload: TPayload,
) {
  return z.object({
    eventId: z.string().uuid(),
    name: z.literal(name),
    occurredAt: z.string().datetime(),
    version: z.literal(1),
    payload,
  });
}
