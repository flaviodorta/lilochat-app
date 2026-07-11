import { Redis } from 'ioredis';
import { pino } from 'pino';
import { z } from 'zod';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { domainEventSchema } from '@lilochat/contracts';
import { bindConsumer } from '../src/messaging/consumer.js';
import { makeDomainEvent } from '../src/messaging/event-factory.js';
import { RedisIdempotencyStore } from '../src/messaging/idempotency.js';
import { RabbitMqBus } from '../src/messaging/rabbitmq-bus.js';

const RABBITMQ_URL = process.env.RABBITMQ_TEST_URL ?? 'amqp://lilochat:lilochat@localhost:5672';
const REDIS_URL = process.env.REDIS_TEST_URL ?? 'redis://localhost:6380/3';

const testEventSchema = domainEventSchema('test.thing.happened', z.object({ value: z.number() }));

// unique queue names per run — the broker persists across runs
const RUN = Date.now().toString(36);
const queueName = (suffix: string) => `it.${RUN}.${suffix}`;

let bus: RabbitMqBus;
let redis: Redis;
const logger = pino({ level: 'silent' });

async function waitFor(condition: () => boolean, timeoutMs = 8_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!condition()) {
    if (Date.now() > deadline) throw new Error('waitFor timed out');
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}

/** Awaited polling — floating channel.get promises reject when the channel closes. */
async function getFromQueue(queue: string, timeoutMs = 8_000): Promise<unknown> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const message = await bus.channel.get(queue, { noAck: true });
    if (message) return JSON.parse(message.content.toString('utf8'));
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`no message arrived in ${queue}`);
}

beforeAll(async () => {
  bus = await RabbitMqBus.connect(RABBITMQ_URL);
  redis = new Redis(REDIS_URL);
  await redis.flushdb();
});

afterAll(async () => {
  await bus.close();
  await redis.quit();
});

describe('messaging backbone (real RabbitMQ + Redis)', () => {
  it('delivers a published event to a bound, schema-validated consumer', async () => {
    const received: number[] = [];
    const queue = queueName('happy');
    await bindConsumer(bus, {
      queue,
      bindings: ['test.thing.happened'],
      schema: testEventSchema,
      handler: async (event) => {
        received.push(event.payload.value);
      },
      idempotency: new RedisIdempotencyStore(redis, { prefix: queue }),
      logger,
    });

    bus.publish(makeDomainEvent('test.thing.happened', { value: 42 }));
    await waitFor(() => received.length === 1);
    expect(received).toEqual([42]);
  });

  it('idempotency: the same eventId is handled exactly once', async () => {
    const received: string[] = [];
    const queue = queueName('dedup');
    await bindConsumer(bus, {
      queue,
      bindings: ['test.thing.happened'],
      schema: testEventSchema,
      handler: async (event) => {
        received.push(event.eventId);
      },
      idempotency: new RedisIdempotencyStore(redis, { prefix: queue }),
      logger,
    });

    const event = makeDomainEvent('test.thing.happened', { value: 7 });
    bus.publish(event);
    bus.publish(event); // duplicate delivery (at-least-once world)

    await waitFor(() => received.length >= 1);
    await new Promise((resolve) => setTimeout(resolve, 500)); // give the dup a chance
    expect(received).toEqual([event.eventId]);
  });

  it('retries with backoff then dead-letters; idempotency claim is released', async () => {
    let attempts = 0;
    const queue = queueName('retry');
    await bindConsumer(bus, {
      queue,
      bindings: ['test.thing.happened'],
      schema: testEventSchema,
      handler: async () => {
        attempts += 1;
        throw new Error('always fails');
      },
      idempotency: new RedisIdempotencyStore(redis, { prefix: queue }),
      logger,
      retries: 3,
      baseDelayMs: 20,
    });

    const event = makeDomainEvent('test.thing.happened', { value: 13 });
    bus.publish(event);

    await waitFor(() => attempts === 3);

    // message landed in the DLQ…
    const dlqMessage = await getFromQueue(`${queue}.dlq`);
    expect((dlqMessage as { eventId: string }).eventId).toBe(event.eventId);

    // …and the claim was released so a DLQ replay can reprocess
    const claim = await redis.get(`processed:${queue}:${event.eventId}`);
    expect(claim).toBeNull();
  });

  it('schema-invalid messages go straight to the DLQ without touching the handler', async () => {
    let handled = 0;
    const queue = queueName('invalid');
    await bindConsumer(bus, {
      queue,
      bindings: ['test.thing.happened'],
      schema: testEventSchema,
      handler: async () => {
        handled += 1;
      },
      idempotency: new RedisIdempotencyStore(redis, { prefix: queue }),
      logger,
    });

    // valid envelope, wrong payload type
    bus.publish(makeDomainEvent('test.thing.happened', { value: 'not-a-number' }) as never);

    await getFromQueue(`${queue}.dlq`);
    expect(handled).toBe(0);
  });
});
