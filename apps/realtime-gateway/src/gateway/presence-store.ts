import type { Redis } from 'ioredis';
import type { PresenceUser } from '@lilochat/contracts';

/**
 * Single source of truth for presence (§6.5) — the fix for the legacy app's
 * ghost users. One ZSET per room: member = session descriptor, score = expiry.
 * Heartbeats push the expiry forward; a sweeper reaps whatever stopped beating
 * (closed laptop, killed tab), so `left` never depends on client goodwill.
 */

export interface PresenceSession {
  sessionId: string;
  userId: string;
  nickname: string;
  joinedAtMs: number;
}

const encode = (s: PresenceSession): string =>
  `${s.sessionId}|${s.userId}|${s.nickname}|${s.joinedAtMs}`;

const decode = (member: string): PresenceSession | null => {
  const [sessionId, userId, nickname, joinedAtMs] = member.split('|');
  if (!sessionId || !userId || !nickname || !joinedAtMs) return null;
  return { sessionId, userId, nickname, joinedAtMs: Number(joinedAtMs) };
};

export class PresenceStore {
  constructor(
    private readonly redis: Redis,
    private readonly ttlMs: number,
  ) {}

  private key(roomId: string): string {
    return `presence:${roomId}`;
  }
  private static readonly ROOMS_KEY = 'presence:rooms';

  async join(roomId: string, session: PresenceSession, nowMs: number): Promise<void> {
    await this.redis
      .multi()
      .zadd(this.key(roomId), nowMs + this.ttlMs, encode(session))
      .sadd(PresenceStore.ROOMS_KEY, roomId)
      .exec();
  }

  /** Piggybacked on sync:ping — no dedicated heartbeat event needed. */
  async refresh(roomId: string, session: PresenceSession, nowMs: number): Promise<void> {
    await this.redis.zadd(this.key(roomId), nowMs + this.ttlMs, encode(session));
  }

  async leave(roomId: string, session: PresenceSession): Promise<void> {
    await this.redis.zrem(this.key(roomId), encode(session));
  }

  /** Distinct users currently present (cleans expired members on the way). */
  async list(roomId: string, nowMs: number): Promise<PresenceUser[]> {
    await this.redis.zremrangebyscore(this.key(roomId), '-inf', nowMs);
    const members = await this.redis.zrange(this.key(roomId), 0, -1);
    const byUser = new Map<string, PresenceUser>();
    for (const member of members) {
      const session = decode(member);
      if (session)
        byUser.set(session.userId, { userId: session.userId, nickname: session.nickname });
    }
    return [...byUser.values()];
  }

  /** Reap expired sessions across all rooms; returns them so the caller can
   *  publish presence.user.left + broadcast — the TTL sweep IS the ghost killer. */
  async sweepExpired(nowMs: number): Promise<Array<{ roomId: string; session: PresenceSession }>> {
    const reaped: Array<{ roomId: string; session: PresenceSession }> = [];
    const roomIds = await this.redis.smembers(PresenceStore.ROOMS_KEY);

    for (const roomId of roomIds) {
      const expired = await this.redis.zrangebyscore(this.key(roomId), '-inf', nowMs);
      if (expired.length > 0) {
        await this.redis.zremrangebyscore(this.key(roomId), '-inf', nowMs);
        for (const member of expired) {
          const session = decode(member);
          if (session) reaped.push({ roomId, session });
        }
      }
      if ((await this.redis.zcard(this.key(roomId))) === 0) {
        await this.redis.srem(PresenceStore.ROOMS_KEY, roomId);
      }
    }
    return reaped;
  }
}
