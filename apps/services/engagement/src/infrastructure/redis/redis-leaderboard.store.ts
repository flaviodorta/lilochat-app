import type { Redis } from 'ioredis';
import type { LeaderboardRow } from '@lilochat/contracts';
import type { LeaderboardStore } from '../../application/watch-time.tracker.js';

/** ZSET reads are O(log N) (§6.5); Postgres user_totals is the rebuild source. */
export class RedisLeaderboardStore implements LeaderboardStore {
  constructor(private readonly redis: Redis) {}

  private key(periodKey: string): string {
    return `leaderboard:${periodKey}`;
  }

  async increment(periodKeys: string[], userId: string, seconds: number): Promise<void> {
    const pipeline = this.redis.multi();
    for (const period of periodKeys) pipeline.zincrby(this.key(period), seconds, userId);
    await pipeline.exec();
  }

  async top(
    periodKey: string,
    limit: number,
    nicknameOf: (userId: string) => Promise<string>,
  ): Promise<LeaderboardRow[]> {
    const flat = await this.redis.zrevrange(this.key(periodKey), 0, limit - 1, 'WITHSCORES');
    const rows: LeaderboardRow[] = [];
    for (let i = 0; i < flat.length; i += 2) {
      const userId = flat[i] as string;
      rows.push({
        rank: i / 2 + 1,
        userId,
        nickname: await nicknameOf(userId),
        seconds: Math.round(Number(flat[i + 1])),
      });
    }
    return rows;
  }

  async rankAndScore(
    periodKey: string,
    userId: string,
  ): Promise<{ rank: number | null; seconds: number }> {
    const [rank, score] = await Promise.all([
      this.redis.zrevrank(this.key(periodKey), userId),
      this.redis.zscore(this.key(periodKey), userId),
    ]);
    return { rank: rank === null ? null : rank + 1, seconds: Math.round(Number(score ?? 0)) };
  }
}
