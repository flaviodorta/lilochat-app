import { CircuitOpenError, makeDomainEvent } from '@lilochat/nest-shared';
import type { QueueItem } from '@lilochat/contracts';
import {
  DuplicateVideoError,
  InvalidVideoUrlError,
  VideoMetadataUnavailableError,
  VideoNotEmbeddableError,
  VideoNotFoundError,
  VideoTooLongError,
} from '../domain/errors.js';
import { parseYoutubeVideoId } from '../domain/video-url.js';
import type {
  Clock,
  IdGenerator,
  QueueItemRecord,
  QueueRepository,
  VideoCacheRepository,
  VideoMetadata,
  VideoMetadataProvider,
} from '../domain/ports.js';
import { toQueueItemDto, type PlaybackManager } from './playback-manager.js';

export interface AddVideoInput {
  roomId: string;
  videoUrl: string;
  addedById: string;
  addedByNickname: string;
}

export class AddVideoUseCase {
  constructor(
    private readonly deps: {
      queue: QueueRepository;
      cache: VideoCacheRepository;
      provider: VideoMetadataProvider; // already breaker-wrapped in infrastructure
      manager: PlaybackManager;
      clock: Clock;
      ids: IdGenerator;
      maxDurationS: number;
    },
  ) {}

  async execute(input: AddVideoInput): Promise<QueueItem> {
    const { queue, manager, clock, ids, maxDurationS } = this.deps;

    const videoId = parseYoutubeVideoId(input.videoUrl);
    if (!videoId) throw new InvalidVideoUrlError();

    const metadata = await this.resolveMetadata(videoId);
    if (!metadata.embeddable) throw new VideoNotEmbeddableError();
    if (metadata.durationS > maxDurationS) throw new VideoTooLongError(maxDurationS);

    if (await queue.hasPendingVideo(input.roomId, videoId)) throw new DuplicateVideoError();

    const now = clock.now();
    const item: QueueItemRecord = {
      id: ids.next(),
      roomId: input.roomId,
      videoId,
      title: metadata.title,
      durationS: metadata.durationS,
      thumbUrl: metadata.thumbUrl,
      addedById: input.addedById,
      addedByNickname: input.addedByNickname,
      position: (await queue.maxPosition(input.roomId)) + 1,
      status: 'PENDING',
      createdAt: now,
      startedAt: null,
      endedAt: null,
    };

    await queue.insertWithEvents(item, [
      makeDomainEvent(
        'playback.video.added',
        {
          roomId: item.roomId,
          itemId: item.id,
          videoId,
          title: item.title,
          durationS: item.durationS,
          thumbUrl: item.thumbUrl,
          addedBy: item.addedById,
        },
        now,
      ),
      makeDomainEvent(
        'playback.queue.updated',
        {
          roomId: item.roomId,
          queue: (await queue.listPending(item.roomId)).concat(item).map(toQueueItemDto),
        },
        now,
      ),
    ]);

    // idle room? this very item starts playing (its own video.started event follows)
    await manager.startIfIdle(input.roomId);

    const fresh = await queue.findById(item.id);
    return toQueueItemDto(fresh ?? item);
  }

  /** Cache-aside: permanent cache (metadata immutable) → provider behind the breaker. */
  private async resolveMetadata(videoId: string): Promise<VideoMetadata> {
    const cached = await this.deps.cache.get(videoId);
    if (cached) return cached;

    let fetched: VideoMetadata | null;
    try {
      fetched = await this.deps.provider.fetch(videoId);
    } catch (error) {
      if (error instanceof CircuitOpenError) throw new VideoMetadataUnavailableError();
      throw new VideoMetadataUnavailableError(); // network/5xx — same degrade for the user
    }
    if (!fetched) throw new VideoNotFoundError();

    await this.deps.cache.save(fetched, this.deps.clock.now());
    return fetched;
  }
}
