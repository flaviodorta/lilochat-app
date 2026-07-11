import type { QueueItem } from '@lilochat/contracts';
import { makeDomainEvent } from '@lilochat/nest-shared';
import { advanceAtMs } from '../domain/timeline.js';
import type {
  AdvanceScheduler,
  Clock,
  PlaybackStateStore,
  QueueItemRecord,
  QueueRepository,
} from '../domain/ports.js';

export type SkipReason = 'vote' | 'ended' | 'removed' | 'empty';

/**
 * The single writer for a room's timeline (§6.2): every transition —
 * start, natural end, skip — funnels through here. Per-room serialization
 * comes from the scheduler (jobId = roomId), not from locks.
 */
export class PlaybackManager {
  constructor(
    private readonly deps: {
      queue: QueueRepository;
      state: PlaybackStateStore;
      scheduler: AdvanceScheduler;
      clock: Clock;
      graceMs: number;
    },
  ) {}

  /** Kicks the room if idle (called after an enqueue). Returns what started. */
  async startIfIdle(roomId: string): Promise<QueueItemRecord | null> {
    const playing = await this.deps.queue.findPlaying(roomId);
    if (playing) return null;
    return this.startNext(roomId);
  }

  /** Natural end (auto-advance job) — finish the current item and move on. */
  async advance(roomId: string): Promise<void> {
    await this.finishCurrent(roomId, 'ended');
    await this.startNext(roomId);
  }

  /** Forced skip (vote passed) — same funnel, different reason. */
  async skip(roomId: string, reason: 'vote' | 'removed'): Promise<void> {
    await this.finishCurrent(roomId, reason);
    await this.startNext(roomId);
  }

  private async finishCurrent(roomId: string, reason: SkipReason): Promise<void> {
    const { queue, state, scheduler, clock } = this.deps;
    const playing = await queue.findPlaying(roomId);
    if (!playing) return;

    const now = clock.now();
    const doneStatus = reason === 'ended' ? 'DONE' : 'SKIPPED';
    await queue.transitionWithEvents(playing.id, { status: doneStatus, endedAt: now }, [
      makeDomainEvent('playback.video.skipped', { roomId, itemId: playing.id, reason }, now),
    ]);
    await state.clear(roomId);
    await scheduler.cancel(playing.id);
  }

  private async startNext(roomId: string): Promise<QueueItemRecord | null> {
    const { queue, state, scheduler, clock } = this.deps;
    const next = await queue.findNextPending(roomId);
    if (!next) return null; // room goes idle — tuple already cleared

    const now = clock.now();
    const pendingAfter = (await queue.listPending(roomId)).filter((i) => i.id !== next.id);

    await queue.transitionWithEvents(next.id, { status: 'PLAYING', startedAt: now }, [
      makeDomainEvent(
        'playback.video.started',
        {
          roomId,
          itemId: next.id,
          videoId: next.videoId,
          title: next.title,
          durationS: next.durationS,
          thumbUrl: next.thumbUrl,
          startedAt: now.toISOString(),
        },
        now,
      ),
      makeDomainEvent(
        'playback.queue.updated',
        { roomId, queue: pendingAfter.map(toQueueItemDto) },
        now,
      ),
    ]);

    await state.set(roomId, {
      itemId: next.id,
      videoId: next.videoId,
      title: next.title,
      thumbUrl: next.thumbUrl,
      durationMs: next.durationS * 1000,
      startedAtMs: now.getTime(),
    });
    await scheduler.schedule({
      roomId,
      itemId: next.id,
      fireAt: new Date(
        advanceAtMs(
          { startedAtMs: now.getTime(), durationMs: next.durationS * 1000 },
          this.deps.graceMs,
        ),
      ),
    });
    return next;
  }
}

export function toQueueItemDto(record: QueueItemRecord): QueueItem {
  return {
    itemId: record.id,
    videoId: record.videoId,
    title: record.title,
    durationS: record.durationS,
    thumbUrl: record.thumbUrl,
    addedById: record.addedById,
    addedByNickname: record.addedByNickname,
    status: record.status === 'PLAYING' ? 'playing' : 'pending',
  };
}
