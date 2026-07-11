import amqp, { type Channel } from 'amqplib';
import type { DomainEvent } from '@lilochat/contracts';

/** Topic exchange for all domain events; routing key = event name (CLAUDE.md §6.1). */
export const LILOCHAT_EXCHANGE = 'lilochat.events';
/** Dead-letter exchange; each queue's rejects route to `<queue>.dlq` by queue name. */
export const LILOCHAT_DLX = 'lilochat.dlx';

type AmqpConnection = Awaited<ReturnType<typeof amqp.connect>>;

export class RabbitMqBus {
  private constructor(
    private readonly connection: AmqpConnection,
    readonly channel: Channel,
  ) {}

  static async connect(url: string): Promise<RabbitMqBus> {
    const connection = await amqp.connect(url);
    const channel = await connection.createChannel();
    await channel.assertExchange(LILOCHAT_EXCHANGE, 'topic', { durable: true });
    await channel.assertExchange(LILOCHAT_DLX, 'direct', { durable: true });
    return new RabbitMqBus(connection, channel);
  }

  publish(event: DomainEvent<unknown>): void {
    this.channel.publish(LILOCHAT_EXCHANGE, event.name, Buffer.from(JSON.stringify(event)), {
      persistent: true,
      contentType: 'application/json',
      messageId: event.eventId,
      timestamp: Math.floor(new Date(event.occurredAt).getTime() / 1000),
    });
  }

  async close(): Promise<void> {
    await this.channel.close().catch(() => undefined);
    await this.connection.close().catch(() => undefined);
  }
}
