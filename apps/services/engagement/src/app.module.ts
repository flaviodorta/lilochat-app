import {
  Inject,
  Module,
  type OnApplicationShutdown,
  type OnApplicationBootstrap,
} from '@nestjs/common';
import { Redis } from 'ioredis';
import { z } from 'zod';
import {
  presenceCheckpointEvent,
  presenceUserJoinedEvent,
  presenceUserLeftEvent,
  userRegisteredEvent,
  userUpdatedEvent,
  videoSkippedEvent,
  videoStartedEvent,
} from '@lilochat/contracts';
import {
  bindConsumer,
  EVENT_BUS,
  HealthModule,
  LoggerModule,
  MessagingModule,
  RedisIdempotencyStore,
  TypedConfigModule,
  LOGGER,
  type Logger,
  type RabbitMqBus,
} from '@lilochat/nest-shared';
import { WatchTimeTracker } from './application/watch-time.tracker.js';
import { ENGAGEMENT_CONFIG, engagementEnvSchema, type EngagementConfig } from './config.js';
import { LeaderboardController } from './infrastructure/http/leaderboard.controller.js';
import { PrismaSessionStore } from './infrastructure/prisma/prisma-session.store.js';
import { PrismaModule } from './infrastructure/prisma/prisma.module.js';
import { PrismaService } from './infrastructure/prisma/prisma.service.js';
import { RedisLeaderboardStore } from './infrastructure/redis/redis-leaderboard.store.js';

export const REDIS = Symbol('REDIS');

@Module({
  imports: [
    TypedConfigModule.forRoot({ token: ENGAGEMENT_CONFIG, schema: engagementEnvSchema }),
    LoggerModule.forRoot({ name: 'engagement', pretty: process.env.NODE_ENV === 'development' }),
    MessagingModule.forRootAsync({
      useFactory: (config: EngagementConfig) => ({ url: config.RABBITMQ_URL }),
      inject: [ENGAGEMENT_CONFIG],
    }),
    PrismaModule,
    HealthModule.forRoot({
      imports: [PrismaModule],
      checks: {
        useFactory: (prisma: PrismaService) => [
          {
            name: 'postgres',
            check: async () => {
              await prisma.$queryRaw`SELECT 1`;
            },
          },
        ],
        inject: [PrismaService],
      },
    }),
  ],
  controllers: [LeaderboardController],
  providers: [
    {
      provide: REDIS,
      useFactory: (config: EngagementConfig) =>
        new Redis(config.REDIS_URL, { maxRetriesPerRequest: 1 }),
      inject: [ENGAGEMENT_CONFIG],
    },
    {
      provide: RedisLeaderboardStore,
      useFactory: (redis: Redis) => new RedisLeaderboardStore(redis),
      inject: [REDIS],
    },
    {
      provide: WatchTimeTracker,
      useFactory: (prisma: PrismaService, leaderboard: RedisLeaderboardStore) =>
        new WatchTimeTracker({ sessions: new PrismaSessionStore(prisma), leaderboard }),
      inject: [PrismaService, RedisLeaderboardStore],
    },
  ],
})
export class AppModule implements OnApplicationBootstrap, OnApplicationShutdown {
  constructor(
    @Inject(EVENT_BUS) private readonly bus: RabbitMqBus,
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(REDIS) private readonly redis: Redis,
    @Inject(LOGGER) private readonly logger: Logger,
    @Inject(ENGAGEMENT_CONFIG) private readonly config: EngagementConfig,
    @Inject(WatchTimeTracker) private readonly tracker: WatchTimeTracker,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    const idempotency = new RedisIdempotencyStore(this.redis, { prefix: 'engagement' });
    const prefix = this.config.ENGAGEMENT_QUEUE_PREFIX;
    const common = { idempotency, logger: this.logger };

    await bindConsumer(this.bus, {
      ...common,
      queue: `${prefix}.presence`,
      bindings: ['presence.user.joined', 'presence.user.left'],
      schema: z.union([presenceUserJoinedEvent, presenceUserLeftEvent]),
      handler: (event) =>
        event.name === 'presence.user.joined'
          ? this.tracker.onJoined(event as never)
          : this.tracker.onLeft(event as never),
    });

    await bindConsumer(this.bus, {
      ...common,
      queue: `${prefix}.checkpoints`,
      bindings: ['presence.checkpoint'],
      schema: presenceCheckpointEvent,
      handler: (event) => this.tracker.onCheckpoint(event),
    });

    await bindConsumer(this.bus, {
      ...common,
      queue: `${prefix}.playback`,
      bindings: ['playback.video.started', 'playback.video.skipped'],
      schema: z.union([videoStartedEvent, videoSkippedEvent]),
      handler: (event) =>
        event.name === 'playback.video.started'
          ? this.tracker.onPlaybackStarted(event.payload.roomId, new Date(event.occurredAt))
          : this.tracker.onPlaybackStopped(event.payload.roomId, new Date(event.occurredAt)),
    });

    // nickname read model for leaderboard rows (§8 denormalization)
    await bindConsumer(this.bus, {
      ...common,
      queue: `${prefix}.identity`,
      bindings: ['identity.user.registered', 'identity.user.updated'],
      schema: z.union([userRegisteredEvent, userUpdatedEvent]),
      handler: async (event) => {
        await this.prisma.userProfile.upsert({
          where: { userId: event.payload.userId },
          create: { userId: event.payload.userId, nickname: event.payload.nickname },
          update: { nickname: event.payload.nickname },
        });
      },
    });
  }

  async onApplicationShutdown(): Promise<void> {
    await this.redis.quit().catch(() => this.redis.disconnect());
  }
}
