import { pino } from 'pino';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { makeDomainEvent } from '../src/messaging/event-factory.js';
import {
  outboxRowFrom,
  OutboxRelay,
  type OutboxClient,
  type OutboxRow,
} from '../src/messaging/outbox.js';
import { LILOCHAT_EXCHANGE, RabbitMqBus } from '../src/messaging/rabbitmq-bus.js';

const RABBITMQ_URL = process.env.RABBITMQ_TEST_URL ?? 'amqp://lilochat:lilochat@localhost:5672';
const RUN = Date.now().toString(36);

/** In-memory OutboxClient — the per-service Prisma adapters are ~5 trivial lines. */
class MemoryOutboxClient implements OutboxClient {
  rows = new Map<string, OutboxRow & { publishedAt: Date | null }>();
  failNextMark = false;

  insert(row: OutboxRow): void {
    this.rows.set(row.id, { ...row, publishedAt: null });
  }

  async fetchUnpublished(batchSize: number): Promise<OutboxRow[]> {
    return [...this.rows.values()]
      .filter((row) => row.publishedAt === null)
      .sort((a, b) => a.id.localeCompare(b.id)) // uuid v7 = time-ordered
      .slice(0, batchSize);
  }

  async markPublished(ids: string[], at: Date): Promise<void> {
    if (this.failNextMark) {
      this.failNextMark = false;
      throw new Error('simulated crash between publish and mark');
    }
    for (const id of ids) {
      const row = this.rows.get(id);
      if (row) row.publishedAt = at;
    }
  }
}

let bus: RabbitMqBus;
const logger = pino({ level: 'silent' });

beforeAll(async () => {
  bus = await RabbitMqBus.connect(RABBITMQ_URL);
});

afterAll(async () => {
  await bus.close();
});

async function collectQueue(queue: string, quietMs = 400): Promise<string[]> {
  const ids: string[] = [];
  let lastSeen = Date.now();
  while (Date.now() - lastSeen < quietMs) {
    const message = await bus.channel.get(queue, { noAck: true });
    if (message) {
      ids.push((JSON.parse(message.content.toString('utf8')) as { eventId: string }).eventId);
      lastSeen = Date.now();
    } else {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }
  return ids;
}

describe('outbox relay (real RabbitMQ)', () => {
  it('publishes batches and marks rows; kill between publish and mark loses NOTHING', async () => {
    const queue = `it.${RUN}.outbox`;
    await bus.channel.assertQueue(queue, { durable: true });
    await bus.channel.bindQueue(queue, LILOCHAT_EXCHANGE, 'outbox.test.event');

    const client = new MemoryOutboxClient();
    const relay = new OutboxRelay({ client, bus, logger, batchSize: 100 });

    // 250 events written "transactionally" while the relay is down
    const eventIds: string[] = [];
    for (let i = 0; i < 250; i += 1) {
      const event = makeDomainEvent('outbox.test.event', { i });
      eventIds.push(event.eventId);
      client.insert(outboxRowFrom(event));
    }

    // first tick: publishes 100, then "crashes" before marking them
    client.failNextMark = true;
    await relay.tick();

    // subsequent ticks (relay restarted): everything still unpublished gets republished
    await relay.tick(); // batch 1 again (duplicates!) — marked this time
    await relay.tick(); // batch 2
    await relay.tick(); // batch 3
    await relay.tick(); // idle

    const received = await collectQueue(queue);

    // at-least-once: duplicates exist (the crashed batch), but NO event was lost
    expect(received.length).toBeGreaterThanOrEqual(250);
    expect(new Set(received)).toEqual(new Set(eventIds));

    // and every row is now marked published
    expect(await client.fetchUnpublished(1000)).toHaveLength(0);

    // consumer idempotency (2.2) is what collapses those duplicates downstream
    const duplicates = received.length - new Set(received).size;
    expect(duplicates).toBe(100); // exactly the crashed batch
  });

  it('overlap guard: concurrent ticks do not double-publish', async () => {
    const queue = `it.${RUN}.outbox-overlap`;
    await bus.channel.assertQueue(queue, { durable: true });
    await bus.channel.bindQueue(queue, LILOCHAT_EXCHANGE, 'outbox.overlap.event');

    const client = new MemoryOutboxClient();
    const relay = new OutboxRelay({ client, bus, logger });
    for (let i = 0; i < 10; i += 1) {
      client.insert(outboxRowFrom(makeDomainEvent('outbox.overlap.event', { i })));
    }

    await Promise.all([relay.tick(), relay.tick(), relay.tick()]);
    await relay.tick(); // drain anything left

    const received = await collectQueue(queue);
    expect(received).toHaveLength(10);
    expect(new Set(received).size).toBe(10);
  });
});
