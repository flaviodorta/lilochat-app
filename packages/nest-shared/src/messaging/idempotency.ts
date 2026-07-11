import type { Redis } from 'ioredis';

/**
 * Consumer idempotency (CLAUDE.md §5.3): at-least-once delivery + dedup by eventId.
 * `claim` returns false when the event was already processed (or is being processed).
 */
export interface IdempotencyStore {
  claim(eventId: string): Promise<boolean>;
  /** Undo a claim after a failed handling so redelivery/DLQ-replay can retry. */
  release(eventId: string): Promise<void>;
}

const DAY_SEC = 24 * 60 * 60;

export class RedisIdempotencyStore implements IdempotencyStore {
  constructor(
    private readonly redis: Redis,
    private readonly options: { prefix: string; ttlSec?: number },
  ) {}

  private key(eventId: string): string {
    return `processed:${this.options.prefix}:${eventId}`;
  }

  async claim(eventId: string): Promise<boolean> {
    const result = await this.redis.set(
      this.key(eventId),
      '1',
      'EX',
      this.options.ttlSec ?? DAY_SEC,
      'NX',
    );
    return result === 'OK';
  }

  async release(eventId: string): Promise<void> {
    await this.redis.del(this.key(eventId));
  }
}
