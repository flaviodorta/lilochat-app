import { randomUUID } from 'node:crypto';
import {
  Inject,
  Module,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { Redis } from 'ioredis';
import {
  EVENT_BUS,
  LOGGER,
  OutboxRelay,
  type Logger,
  type RabbitMqBus,
} from '@lilochat/nest-shared';
import { AddVideoUseCase } from '../application/add-video.usecase.js';
import { VoteEngine } from '../application/vote-engine.js';
import { GetRoomStateUseCase } from '../application/get-room-state.usecase.js';
import { PlaybackManager } from '../application/playback-manager.js';
import { RemoveItemUseCase } from '../application/remove-item.usecase.js';
import type { Clock, IdGenerator } from '../domain/ports.js';
import { PLAYBACK_CONFIG, type PlaybackConfig } from '../config.js';
import { DomainErrorFilter } from './http/domain-error.filter.js';
import { PlaybackController } from './http/playback.controller.js';
import { PrismaOutboxClient } from './prisma/prisma-outbox.client.js';
import { PrismaQueueRepository } from './prisma/prisma-queue.repository.js';
import { PrismaVideoCacheRepository } from './prisma/prisma-video-cache.repository.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { PrismaService } from './prisma/prisma.service.js';
import { RedisBallotStore } from './redis/redis-ballot.store.js';
import { RedisPlaybackStateStore } from './redis/redis-playback-state.store.js';
import { RedisPresenceReader } from './redis/redis-presence.reader.js';
import { PrismaVoteRepository } from './prisma/prisma-vote.repository.js';
import { BullMqAdvanceScheduler } from './scheduler/bullmq-advance.scheduler.js';
import { YoutubeMetadataProvider } from './youtube/youtube-metadata.provider.js';

export const REDIS = Symbol('REDIS');
export const SCHEDULER = Symbol('SCHEDULER');
const CLOCK: Clock = { now: () => new Date() };
const IDS: IdGenerator = { next: () => randomUUID() };

@Module({
  imports: [PrismaModule],
  controllers: [PlaybackController],
  providers: [
    { provide: APP_FILTER, useClass: DomainErrorFilter },
    {
      provide: REDIS,
      useFactory: (config: PlaybackConfig) =>
        new Redis(config.REDIS_URL, { maxRetriesPerRequest: 1 }),
      inject: [PLAYBACK_CONFIG],
    },
    {
      provide: SCHEDULER,
      useFactory: (config: PlaybackConfig, logger: Logger) =>
        new BullMqAdvanceScheduler({
          queueName: config.ADVANCE_QUEUE_NAME,
          redisUrl: config.REDIS_URL,
          logger,
        }),
      inject: [PLAYBACK_CONFIG, LOGGER],
    },
    {
      provide: PlaybackManager,
      useFactory: (
        prisma: PrismaService,
        redis: Redis,
        scheduler: BullMqAdvanceScheduler,
        config: PlaybackConfig,
      ) =>
        new PlaybackManager({
          queue: new PrismaQueueRepository(prisma),
          state: new RedisPlaybackStateStore(redis),
          scheduler,
          clock: CLOCK,
          graceMs: config.ADVANCE_GRACE_MS,
        }),
      inject: [PrismaService, REDIS, SCHEDULER, PLAYBACK_CONFIG],
    },
    {
      provide: AddVideoUseCase,
      useFactory: (prisma: PrismaService, manager: PlaybackManager, config: PlaybackConfig) =>
        new AddVideoUseCase({
          queue: new PrismaQueueRepository(prisma),
          cache: new PrismaVideoCacheRepository(prisma),
          provider: new YoutubeMetadataProvider({
            apiUrl: config.YOUTUBE_API_URL,
            apiKey: config.YOUTUBE_API_KEY,
          }),
          manager,
          clock: CLOCK,
          ids: IDS,
          maxDurationS: config.MAX_VIDEO_DURATION_S,
        }),
      inject: [PrismaService, PlaybackManager, PLAYBACK_CONFIG],
    },
    {
      provide: VoteEngine,
      useFactory: (
        prisma: PrismaService,
        redis: Redis,
        manager: PlaybackManager,
        scheduler: BullMqAdvanceScheduler,
      ) =>
        new VoteEngine({
          votes: new PrismaVoteRepository(prisma),
          ballots: new RedisBallotStore(redis),
          presence: new RedisPresenceReader(redis),
          playbackState: new RedisPlaybackStateStore(redis),
          manager,
          scheduler,
          clock: CLOCK,
          ids: IDS,
          windowS: 45,
          cooldownS: 90,
        }),
      inject: [PrismaService, REDIS, PlaybackManager, SCHEDULER],
    },
    {
      provide: GetRoomStateUseCase,
      useFactory: (prisma: PrismaService, redis: Redis) =>
        new GetRoomStateUseCase({
          state: new RedisPlaybackStateStore(redis),
          queue: new PrismaQueueRepository(prisma),
          clock: CLOCK,
        }),
      inject: [PrismaService, REDIS],
    },
    {
      provide: RemoveItemUseCase,
      useFactory: (prisma: PrismaService) =>
        new RemoveItemUseCase({ queue: new PrismaQueueRepository(prisma), clock: CLOCK }),
      inject: [PrismaService],
    },
  ],
})
export class PlaybackModule implements OnApplicationBootstrap, OnApplicationShutdown {
  private relay: OutboxRelay | null = null;

  constructor(
    @Inject(EVENT_BUS) private readonly bus: RabbitMqBus,
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(REDIS) private readonly redis: Redis,
    @Inject(SCHEDULER) private readonly scheduler: BullMqAdvanceScheduler,
    @Inject(PlaybackManager) private readonly manager: PlaybackManager,
    @Inject(VoteEngine) private readonly voteEngine: VoteEngine,
    @Inject(LOGGER) private readonly logger: Logger,
  ) {}

  onApplicationBootstrap(): void {
    this.relay = new OutboxRelay({
      client: new PrismaOutboxClient(this.prisma),
      bus: this.bus,
      logger: this.logger,
    });
    this.relay.start();

    // one worker, two job kinds: advances and vote resolutions
    this.scheduler.startWorker({
      advance: (roomId) => this.manager.advance(roomId),
      resolveVote: (voteId) => this.voteEngine.resolveByTimeout(voteId),
    });
  }

  async onApplicationShutdown(): Promise<void> {
    if (this.relay) {
      this.relay.stop();
      await this.relay.tick();
    }
    await this.scheduler.close();
    await this.redis.quit().catch(() => this.redis.disconnect());
  }
}
