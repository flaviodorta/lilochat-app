import type { Redis } from 'ioredis';
import type { PresenceReader } from '../../domain/ports.js';

/**
 * Reads the realtime-gateway's presence ZSET (`presence:{roomId}`, member =
 * `sessionId|userId|nickname|joinedAtMs`, score = expiry). The §5.3 quorum
 * seam: shared Redis, documented key contract, distinct USERS counted.
 */
export class RedisPresenceReader implements PresenceReader {
  constructor(private readonly redis: Redis) {}

  async countPresent(roomId: string): Promise<number> {
    const members = await this.redis.zrangebyscore(`presence:${roomId}`, Date.now(), '+inf');
    const users = new Set<string>();
    for (const member of members) {
      const userId = member.split('|')[1];
      if (userId) users.add(userId);
    }
    return users.size;
  }
}
