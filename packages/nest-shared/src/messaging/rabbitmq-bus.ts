import amqp, { type Channel } from 'amqplib';
import { metrics } from '@opentelemetry/api';
import type { DomainEvent } from '@lilochat/contracts';
import { createLogger } from '../logger/logger.js';
import { injectTraceHeaders } from '../observability/otel.js';

/** Topic exchange for all domain events; routing key = event name (CLAUDE.md §6.1). */
export const LILOCHAT_EXCHANGE = 'lilochat.events';
/** Dead-letter exchange; each queue's rejects route to `<queue>.dlq` by queue name. */
export const LILOCHAT_DLX = 'lilochat.dlx';

type AmqpConnection = Awaited<ReturnType<typeof amqp.connect>>;

/** Re-runs on every (re)connected channel — consumers register their whole topology here. */
export type ChannelSetup = (channel: Channel) => Promise<void>;

/** Publish buffer cap while the broker is away — beyond this, oldest events drop (logged). */
const PENDING_MAX = 5000;
const RECONNECT_MAX_DELAY_MS = 15_000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * amqplib does NOT auto-reconnect: without this loop, one broker restart
 * would silently kill every service's bus until a redeploy (found by the 6.5
 * degradation drill). On unexpected close: exponential backoff reconnect,
 * re-assert exchanges, replay every registered ChannelSetup (consumers
 * re-bind), then flush the bounded publish buffer. §9.1 graceful degradation:
 * while the broker is away, publishes buffer instead of throwing — chat's
 * optimistic broadcasts keep flowing and persistence catches up.
 */
export class RabbitMqBus {
  private connection!: AmqpConnection;
  private _channel!: Channel;
  private readonly setups: ChannelSetup[] = [];
  private readonly pending: DomainEvent<unknown>[] = [];
  private closed = false;
  private reconnecting = false;
  private readonly logger = createLogger({ name: 'rabbitmq-bus' });

  private readonly meter = metrics.getMeter('lilochat.messaging');
  private readonly published = this.meter.createCounter('lilochat.events.published', {
    description: 'Domain events published',
  });
  private readonly buffered = this.meter.createCounter('lilochat.events.buffered', {
    description: 'Publishes buffered while the broker was unreachable',
  });
  private readonly reconnects = this.meter.createCounter('lilochat.bus.reconnects', {
    description: 'Successful broker reconnections',
  });

  private constructor(private readonly url: string) {}

  static async connect(url: string): Promise<RabbitMqBus> {
    const bus = new RabbitMqBus(url);
    await bus.open();
    return bus;
  }

  /** Current channel — valid until the next disconnect; tests use it directly. */
  get channel(): Channel {
    return this._channel;
  }

  /** Register topology that must survive reconnects (queues, bindings, consumers). */
  async registerSetup(setup: ChannelSetup): Promise<void> {
    this.setups.push(setup);
    await setup(this._channel);
  }

  publish(event: DomainEvent<unknown>): void {
    try {
      this._channel.publish(LILOCHAT_EXCHANGE, event.name, Buffer.from(JSON.stringify(event)), {
        persistent: true,
        contentType: 'application/json',
        messageId: event.eventId,
        timestamp: Math.floor(new Date(event.occurredAt).getTime() / 1000),
        // W3C traceparent rides the message (§10) — consumers continue the trace
        headers: injectTraceHeaders(),
      });
      this.published.add(1, { 'event.name': event.name });
    } catch {
      this.buffer(event);
    }
  }

  async close(): Promise<void> {
    this.closed = true;
    await this._channel?.close().catch(() => undefined);
    await this.connection?.close().catch(() => undefined);
  }

  private async open(): Promise<void> {
    const connection = await amqp.connect(this.url);
    const channel = await connection.createChannel();
    await channel.assertExchange(LILOCHAT_EXCHANGE, 'topic', { durable: true });
    await channel.assertExchange(LILOCHAT_DLX, 'direct', { durable: true });

    // both handlers required: an unhandled 'error' event would crash the process
    connection.on('error', (error) => this.logger.warn({ err: error }, 'amqp connection error'));
    connection.on('close', () => {
      if (this.closed) return;
      this.logger.warn('amqp connection lost — reconnecting');
      void this.reconnect();
    });

    this.connection = connection;
    this._channel = channel;
    for (const setup of this.setups) await setup(channel);
    this.flushPending();
  }

  private async reconnect(): Promise<void> {
    if (this.reconnecting || this.closed) return;
    this.reconnecting = true;
    for (let attempt = 1; !this.closed; attempt += 1) {
      const backoff = Math.min(RECONNECT_MAX_DELAY_MS, 500 * 2 ** Math.min(attempt, 5));
      await sleep(Math.random() * backoff); // full jitter, same policy as consumers
      try {
        await this.open();
        this.reconnecting = false;
        this.reconnects.add(1);
        this.logger.info({ attempt, buffered: this.pending.length }, 'amqp reconnected');
        return;
      } catch (error) {
        this.logger.warn({ err: error, attempt }, 'amqp reconnect failed — retrying');
      }
    }
    this.reconnecting = false;
  }

  private buffer(event: DomainEvent<unknown>): void {
    if (this.pending.length >= PENDING_MAX) {
      const dropped = this.pending.shift();
      this.logger.error(
        { eventId: dropped?.eventId },
        'publish buffer full — oldest event DROPPED',
      );
    }
    this.pending.push(event);
    this.buffered.add(1, { 'event.name': event.name });
  }

  private flushPending(): void {
    if (this.pending.length === 0) return;
    const replay = this.pending.splice(0);
    this.logger.info({ count: replay.length }, 'flushing buffered publishes');
    for (const event of replay) this.publish(event);
  }
}
