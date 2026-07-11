import type { Redis } from 'ioredis';
import type { PlaybackStateStore } from '../../domain/ports.js';

type Tuple = Parameters<PlaybackStateStore['set']>[1];

/** The hot tuple (§6.2): `room:{id}:playback` — what every reader syncs from. */
export class RedisPlaybackStateStore implements PlaybackStateStore {
  constructor(private readonly redis: Redis) {}

  private key(roomId: string): string {
    return `room:${roomId}:playback`;
  }

  async set(roomId: string, state: Tuple): Promise<void> {
    await this.redis.hset(this.key(roomId), {
      itemId: state.itemId,
      videoId: state.videoId,
      title: state.title,
      thumbUrl: state.thumbUrl,
      durationMs: String(state.durationMs),
      startedAtMs: String(state.startedAtMs),
    });
  }

  async get(roomId: string): Promise<Tuple | null> {
    const hash = await this.redis.hgetall(this.key(roomId));
    if (!hash.itemId) return null;
    return {
      itemId: hash.itemId,
      videoId: hash.videoId ?? '',
      title: hash.title ?? '',
      thumbUrl: hash.thumbUrl ?? '',
      durationMs: Number(hash.durationMs),
      startedAtMs: Number(hash.startedAtMs),
    };
  }

  async clear(roomId: string): Promise<void> {
    await this.redis.del(this.key(roomId));
  }
}
