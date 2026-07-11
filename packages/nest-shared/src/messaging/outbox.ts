import type { DomainEvent } from '@lilochat/contracts';
import type { Logger } from 'pino';
import type { RabbitMqBus } from './rabbitmq-bus.js';

/**
 * Transactional outbox (ADR-005). Every publishing service owns a table with
 * this exact shape (Prisma model convention — see identity/rooms/playback):
 *
 *   model OutboxEvent {
 *     id          String    @id @db.Uuid            // eventId (uuid v7)
 *     name        String
 *     payload     Json
 *     occurredAt  DateTime  @map("occurred_at")
 *     publishedAt DateTime? @map("published_at")
 *     @@index([publishedAt, id])
 *     @@map("outbox_events")
 *   }
 *
 * Domain writes insert the event row IN THE SAME TRANSACTION as the state
 * change; the relay polls and publishes. At-least-once by design (publish,
 * then mark) — consumer idempotency (2.2) turns it into effectively-once.
 */

export interface OutboxRow {
  id: string;
  name: string;
  payload: unknown;
  occurredAt: Date;
}

/** Each service implements this over its own PrismaClient (≈5 lines). */
export interface OutboxClient {
  fetchUnpublished(batchSize: number): Promise<OutboxRow[]>;
  markPublished(ids: string[], at: Date): Promise<void>;
}

/** Shape a DomainEvent into the outbox row to insert inside the domain transaction. */
export function outboxRowFrom(event: DomainEvent<unknown>): OutboxRow {
  return {
    id: event.eventId,
    name: event.name,
    payload: event.payload,
    occurredAt: new Date(event.occurredAt),
  };
}

function rowToEvent(row: OutboxRow): DomainEvent<unknown> {
  return {
    eventId: row.id,
    name: row.name,
    occurredAt: row.occurredAt.toISOString(),
    version: 1,
    payload: row.payload,
  };
}

export interface OutboxRelayOptions {
  client: OutboxClient;
  bus: RabbitMqBus;
  logger: Logger;
  batchSize?: number; // default 100
  intervalMs?: number; // default 500
}

export class OutboxRelay {
  private timer: ReturnType<typeof setInterval> | null = null;
  private ticking = false;

  constructor(private readonly options: OutboxRelayOptions) {}

  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => void this.tick(), this.options.intervalMs ?? 500);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  /** One poll cycle; overlap-guarded. Exposed for tests and drain-on-shutdown. */
  async tick(): Promise<void> {
    if (this.ticking) return;
    this.ticking = true;
    try {
      const { client, bus, logger } = this.options;
      const batch = await client.fetchUnpublished(this.options.batchSize ?? 100);
      if (batch.length === 0) return;

      for (const row of batch) {
        bus.publish(rowToEvent(row));
      }
      // crash window here ⇒ republish on next tick — at-least-once, never lost
      await client.markPublished(
        batch.map((row) => row.id),
        new Date(),
      );
      logger.debug({ count: batch.length }, 'outbox batch published');
    } catch (error) {
      this.options.logger.error({ err: error }, 'outbox relay tick failed — will retry');
    } finally {
      this.ticking = false;
    }
  }
}
