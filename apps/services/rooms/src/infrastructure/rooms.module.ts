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
  presenceUserJoinedEvent,
  presenceUserLeftEvent,
  videoStartedEvent,
} from '@lilochat/contracts';
import {
  bindConsumer,
  EVENT_BUS,
  LOGGER,
  OutboxRelay,
  RedisIdempotencyStore,
  type Logger,
  type RabbitMqBus,
} from '@lilochat/nest-shared';
import { CreateRoomUseCase } from '../application/create-room.usecase.js';
import { GetRoomUseCase } from '../application/get-room.usecase.js';
import { ListRoomsUseCase } from '../application/list-rooms.usecase.js';
import type { Clock, IdGenerator, RoomCardRepository, RoomRepository } from '../domain/ports.js';
import { ROOMS_CONFIG, type RoomsConfig } from '../config.js';
import { DomainErrorFilter } from './http/domain-error.filter.js';
import { RoomsController } from './http/rooms.controller.js';
import { PrismaOutboxClient } from './prisma/prisma-outbox.client.js';
import { PrismaRoomCardRepository } from './prisma/prisma-room-card.repository.js';
import { PrismaRoomRepository } from './prisma/prisma-room.repository.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { PrismaService } from './prisma/prisma.service.js';

export const ROOM_REPOSITORY = Symbol('ROOM_REPOSITORY');
export const ROOM_CARD_REPOSITORY = Symbol('ROOM_CARD_REPOSITORY');
export const CLOCK = Symbol('CLOCK');
export const ID_GENERATOR = Symbol('ID_GENERATOR');
export const REDIS = Symbol('REDIS');

@Module({
  imports: [PrismaModule],
  controllers: [RoomsController],
  providers: [
    { provide: APP_FILTER, useClass: DomainErrorFilter },
    { provide: CLOCK, useValue: { now: () => new Date() } satisfies Clock },
    { provide: ID_GENERATOR, useValue: { next: () => randomUUID() } satisfies IdGenerator },
    {
      provide: REDIS,
      useFactory: (config: RoomsConfig) => new Redis(config.REDIS_URL, { maxRetriesPerRequest: 1 }),
      inject: [ROOMS_CONFIG],
    },
    {
      provide: ROOM_REPOSITORY,
      useFactory: (prisma: PrismaService) => new PrismaRoomRepository(prisma),
      inject: [PrismaService],
    },
    {
      provide: ROOM_CARD_REPOSITORY,
      useFactory: (prisma: PrismaService) => new PrismaRoomCardRepository(prisma),
      inject: [PrismaService],
    },
    {
      provide: CreateRoomUseCase,
      useFactory: (rooms: RoomRepository, clock: Clock, ids: IdGenerator) =>
        new CreateRoomUseCase({ rooms, clock, ids }),
      inject: [ROOM_REPOSITORY, CLOCK, ID_GENERATOR],
    },
    {
      provide: ListRoomsUseCase,
      useFactory: (cards: RoomCardRepository, clock: Clock) =>
        new ListRoomsUseCase({ cards, clock }),
      inject: [ROOM_CARD_REPOSITORY, CLOCK],
    },
    {
      provide: GetRoomUseCase,
      useFactory: (rooms: RoomRepository, cards: RoomCardRepository) =>
        new GetRoomUseCase({ rooms, cards }),
      inject: [ROOM_REPOSITORY, ROOM_CARD_REPOSITORY],
    },
  ],
})
export class RoomsModule implements OnApplicationBootstrap, OnApplicationShutdown {
  private relay: OutboxRelay | null = null;

  constructor(
    @Inject(EVENT_BUS) private readonly bus: RabbitMqBus,
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(REDIS) private readonly redis: Redis,
    @Inject(LOGGER) private readonly logger: Logger,
    @Inject(ROOMS_CONFIG) private readonly config: RoomsConfig,
    @Inject(ROOM_CARD_REPOSITORY) private readonly cards: RoomCardRepository,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    this.relay = new OutboxRelay({
      client: new PrismaOutboxClient(this.prisma),
      bus: this.bus,
      logger: this.logger,
    });
    this.relay.start();

    await bindConsumer(this.bus, {
      queue: this.config.ROOMS_CONSUMER_QUEUE,
      bindings: ['playback.video.started'],
      schema: videoStartedEvent,
      handler: async (event) => {
        const { roomId, videoId, title, thumbUrl, durationS, startedAt } = event.payload;
        await this.cards.applyVideoStarted({
          roomId,
          videoId,
          title,
          thumbUrl,
          durationS,
          startedAt: new Date(startedAt),
        });
      },
      idempotency: new RedisIdempotencyStore(this.redis, { prefix: 'rooms' }),
      logger: this.logger,
    });

    // presence → durable viewer counts on the card read model (§6.5)
    const { z } = await import('zod');
    await bindConsumer(this.bus, {
      queue: this.config.ROOMS_PRESENCE_QUEUE,
      bindings: ['presence.user.joined', 'presence.user.left'],
      schema: z.union([presenceUserJoinedEvent, presenceUserLeftEvent]),
      handler: async (event) => {
        const delta = event.name === 'presence.user.joined' ? 1 : -1;
        await this.cards.adjustViewers(event.payload.roomId, delta);
      },
      idempotency: new RedisIdempotencyStore(this.redis, { prefix: 'rooms' }),
      logger: this.logger,
    });
  }

  async onApplicationShutdown(): Promise<void> {
    if (this.relay) {
      this.relay.stop();
      await this.relay.tick(); // drain the last batch before dying (graceful shutdown)
    }
    await this.redis.quit().catch(() => this.redis.disconnect());
  }
}
