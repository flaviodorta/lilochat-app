import type { Redis } from 'ioredis';
import type { BallotStore } from '../../domain/ports.js';

export class RedisBallotStore implements BallotStore {
  constructor(private readonly redis: Redis) {}

  async addYes(voteId: string, userId: string, ttlS: number): Promise<boolean> {
    const key = `vote:${voteId}:yes`;
    const added = await this.redis.sadd(key, userId);
    await this.redis.expire(key, ttlS);
    return added === 1;
  }

  async countYes(voteId: string): Promise<number> {
    return this.redis.scard(`vote:${voteId}:yes`);
  }

  async clear(voteId: string): Promise<void> {
    await this.redis.del(`vote:${voteId}:yes`);
  }

  async setCooldown(roomId: string, itemId: string, seconds: number): Promise<void> {
    await this.redis.set(`vote-cooldown:${roomId}:${itemId}`, '1', 'EX', seconds);
  }

  async isCoolingDown(roomId: string, itemId: string): Promise<boolean> {
    return (await this.redis.exists(`vote-cooldown:${roomId}:${itemId}`)) === 1;
  }
}
