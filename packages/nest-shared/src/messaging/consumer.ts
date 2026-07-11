import { performance } from 'node:perf_hooks';
import {
  context,
  metrics,
  propagation,
  ROOT_CONTEXT,
  SpanKind,
  SpanStatusCode,
  trace,
} from '@opentelemetry/api';
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
 * Each delivery runs inside a CONSUMER span continued from the publisher's
 * traceparent header (§10 — correlated traces across the event bus).
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

  // acquired at bind time, NOT module scope: the metrics api resolves its
  // global provider eagerly, and ESM hoists imports above startOtel()
  const meter = metrics.getMeter('lilochat.messaging');
  const tracer = trace.getTracer('lilochat.messaging');
  const consumed = meter.createCounter('lilochat.events.consumed', {
    description: 'Domain event deliveries by outcome',
  });
  const handlerDuration = meter.createHistogram('lilochat.event.handler.duration', {
    unit: 'ms',
    description: 'Event handler processing time (all attempts)',
  });

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
        consumed.add(1, { queue, outcome: 'invalid' });
        channel.nack(message, false, false); // → DLQ
        return;
      }

      const { eventId, name } = event as { eventId: string; name: string };
      if (!(await idempotency.claim(eventId))) {
        logger.debug({ eventId, queue }, 'duplicate event skipped');
        consumed.add(1, { queue, outcome: 'duplicate' });
        channel.ack(message);
        return;
      }

      const parent = propagation.extract(ROOT_CONTEXT, message.properties.headers ?? {});
      const span = tracer.startSpan(
        `consume ${name}`,
        {
          kind: SpanKind.CONSUMER,
          attributes: {
            'messaging.system': 'rabbitmq',
            'messaging.destination.name': queue,
            'lilochat.event.name': name,
            'lilochat.event.id': eventId,
          },
        },
        parent,
      );
      const startedAt = performance.now();

      await context.with(trace.setSpan(parent, span), async () => {
        for (let attempt = 1; attempt <= retries; attempt += 1) {
          try {
            await handler(event);
            channel.ack(message);
            consumed.add(1, { queue, outcome: 'handled', 'event.name': name });
            span.end();
            handlerDuration.record(performance.now() - startedAt, { queue });
            return;
          } catch (error) {
            if (attempt === retries) {
              logger.error(
                { err: error, eventId, queue, attempt },
                'handler exhausted retries — dead-lettering',
              );
              await idempotency.release(eventId); // allow DLQ replay to reprocess
              channel.nack(message, false, false);
              consumed.add(1, { queue, outcome: 'dead_lettered', 'event.name': name });
              span.setStatus({ code: SpanStatusCode.ERROR });
              span.end();
              handlerDuration.record(performance.now() - startedAt, { queue });
              return;
            }
            const backoff = baseDelayMs * 2 ** (attempt - 1);
            const delay = Math.random() * backoff; // full jitter
            span.addEvent('retry', { attempt });
            logger.warn(
              { err: error, eventId, queue, attempt, delay },
              'handler failed — retrying',
            );
            await sleep(delay);
          }
        }
      });
    })();
  });
}
