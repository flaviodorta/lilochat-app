import type { PlaybackState, QueueItem } from '@lilochat/contracts';
import type { Clock, PlaybackStateStore, QueueRepository } from '../domain/ports.js';
import { toQueueItemDto } from './playback-manager.js';

export interface RoomPlaybackState {
  playback: PlaybackState | null;
  queue: QueueItem[];
  serverNow: string;
}

/** Read side for gateway composition (GET /rooms/:id) and RTG resyncs. */
export class GetRoomStateUseCase {
  constructor(
    private readonly deps: {
      state: PlaybackStateStore;
      queue: QueueRepository;
      clock: Clock;
    },
  ) {}

  async execute(roomId: string): Promise<RoomPlaybackState> {
    const [tuple, pending] = await Promise.all([
      this.deps.state.get(roomId),
      this.deps.queue.listPending(roomId),
    ]);

    return {
      playback: tuple
        ? {
            itemId: tuple.itemId,
            videoId: tuple.videoId,
            title: tuple.title,
            thumbUrl: tuple.thumbUrl,
            durationS: Math.round(tuple.durationMs / 1000),
            startedAt: new Date(tuple.startedAtMs).toISOString(),
          }
        : null,
      queue: pending.map(toQueueItemDto),
      serverNow: this.deps.clock.now().toISOString(),
    };
  }
}
