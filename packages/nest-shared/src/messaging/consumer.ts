import type { z } from 'zod';
import type { Logger } from 'pino';
import type { IdempotencyStore } from './idempotency.js';
import { LILOCHAT_DLX, LILOCHAT_EXCHANGE, type RabbitMqBus } from './rabbitmq-bus.js';

export interface ConsumerOptions<TSchema extends z.ZodTypeAny> {
  /** Durable, service-owned queue, e.g. `rooms.playback-events`. */
  queue: string;
  /** Routing keys to bind, e.g. `['playback.video.started']` (topic wildcards ok). */
  bindings: string[];
  /** Full event schema (envelope + payload). Invalid messages go straight to the DLQ. */
  schema: TSchema;
  handler: (event: z.infer<TSchema>) => Promise<void>;
  idempotency: IdempotencyStore;
  logger: Logger;
  /** In-process attempts before dead-lettering (default 3). */
  retries?: number;
  /** Base backoff (default 200 ms) — exponential with full jitter. */
  baseDelayMs?: number;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * The one true consumer shape (CLAUDE.md §5.3 / §9.1): zod-parse → idempotency
 * claim → retry with exponential backoff + full jitter → DLQ on exhaustion.
 * At-least-once + dedup by eventId ⇒ effectively-once handling.
 */
export async function bindConsumer<TSchema extends z.ZodTypeAny>(
  bus: RabbitMqBus,
  options: ConsumerOptions<TSchema>,
): Promise<void> {
  const { channel } = bus;
  const { queue, bindings, schema, handler, idempotency, logger } = options;
  const retries = options.retries ?? 3;
  const baseDelayMs = options.baseDelayMs ?? 200;
  const dlq = `${queue}.dlq`;

  await channel.assertQueue(dlq, { durable: true });
  await channel.bindQueue(dlq, LILOCHAT_DLX, queue); // DLX routes by original queue name
  await channel.assertQueue(queue, {
    durable: true,
    arguments: {
      'x-dead-letter-exchange': LILOCHAT_DLX,
      'x-dead-letter-routing-key': queue,
    },
  });
  for (const key of bindings) {
    await channel.bindQueue(queue, LILOCHAT_EXCHANGE, key);
  }

  await channel.consume(queue, (message) => {
    if (!message) return;
    void (async () => {
      let event: z.infer<TSchema>;
      try {
        event = schema.parse(JSON.parse(message.content.toString('utf8')));
      } catch (error) {
        logger.error({ err: error, queue }, 'invalid event payload — dead-lettering');
        channel.nack(message, false, false); // → DLQ
        return;
      }

      const eventId = (event as { eventId: string }).eventId;
      if (!(await idempotency.claim(eventId))) {
        logger.debug({ eventId, queue }, 'duplicate event skipped');
        channel.ack(message);
        return;
      }

      for (let attempt = 1; attempt <= retries; attempt += 1) {
        try {
          await handler(event);
          channel.ack(message);
          return;
        } catch (error) {
          if (attempt === retries) {
            logger.error(
              { err: error, eventId, queue, attempt },
              'handler exhausted retries — dead-lettering',
            );
            await idempotency.release(eventId); // allow DLQ replay to reprocess
            channel.nack(message, false, false);
            return;
          }
          const backoff = baseDelayMs * 2 ** (attempt - 1);
          const delay = Math.random() * backoff; // full jitter
          logger.warn({ err: error, eventId, queue, attempt, delay }, 'handler failed — retrying');
          await sleep(delay);
        }
      }
    })();
  });
}
