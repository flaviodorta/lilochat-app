import type { DomainEvent } from '@lilochat/contracts';

export interface VideoMetadata {
  videoId: string;
  title: string;
  durationS: number;
  thumbUrl: string;
  embeddable: boolean;
}

/** Remote lookup (YouTube Data API). null = video does not exist. */
export interface VideoMetadataProvider {
  fetch(videoId: string): Promise<VideoMetadata | null>;
}

/** Permanent cache-aside over the provider (metadata is immutable). */
export interface VideoCacheRepository {
  get(videoId: string): Promise<VideoMetadata | null>;
  save(metadata: VideoMetadata, fetchedAt: Date): Promise<void>;
}

export interface QueueItemRecord {
  id: string;
  roomId: string;
  videoId: string;
  title: string;
  durationS: number;
  thumbUrl: string;
  addedById: string;
  addedByNickname: string;
  position: number;
  status: 'PENDING' | 'PLAYING' | 'DONE' | 'SKIPPED';
  createdAt: Date;
  startedAt: Date | null;
  endedAt: Date | null;
}

export interface QueueRepository {
  /** Insert + outbox events in one transaction. */
  insertWithEvents(item: QueueItemRecord, events: DomainEvent<unknown>[]): Promise<void>;
  /** Status transition + outbox events in one transaction. */
  transitionWithEvents(
    itemId: string,
    changes: { status: QueueItemRecord['status']; startedAt?: Date; endedAt?: Date },
    events: DomainEvent<unknown>[],
  ): Promise<void>;
  findById(itemId: string): Promise<QueueItemRecord | null>;
  findPlaying(roomId: string): Promise<QueueItemRecord | null>;
  findNextPending(roomId: string): Promise<QueueItemRecord | null>;
  listPending(roomId: string): Promise<QueueItemRecord[]>;
  hasPendingVideo(roomId: string, videoId: string): Promise<boolean>;
  maxPosition(roomId: string): Promise<number>;
}

/** The hot tuple in Redis: what the gateway/RTG read to answer "where is the room". */
export interface PlaybackStateStore {
  set(
    roomId: string,
    state: {
      itemId: string;
      videoId: string;
      title: string;
      thumbUrl: string;
      durationMs: number;
      startedAtMs: number;
    },
  ): Promise<void>;
  get(roomId: string): Promise<{
    itemId: string;
    videoId: string;
    title: string;
    thumbUrl: string;
    durationMs: number;
    startedAtMs: number;
  } | null>;
  clear(roomId: string): Promise<void>;
}

/**
 * Delayed auto-advance job, keyed by ITEM (not room): rescheduling happens
 * from inside the previous item's worker run, and BullMQ silently dedupes an
 * add() whose jobId matches the still-active job. Per-room serialization holds
 * anyway — only one item is PLAYING per room at any time.
 */
export interface AdvanceScheduler {
  schedule(input: { roomId: string; itemId: string; fireAt: Date }): Promise<void>;
  cancel(itemId: string): Promise<void>;
}

export interface Clock {
  now(): Date;
}

export interface IdGenerator {
  next(): string;
}
