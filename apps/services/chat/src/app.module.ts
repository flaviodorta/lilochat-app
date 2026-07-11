import {
  Inject,
  Module,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from '@nestjs/common';
import type { Redis } from 'ioredis';
import { chatMessageSubmittedEvent } from '@lilochat/contracts';
import {
  createRedisClient,
  bindConsumer,
  EVENT_BUS,
  HealthModule,
  LoggerModule,
  MessagingModule,
  OutboxRelay,
  RedisIdempotencyStore,
  TypedConfigModule,
  LOGGER,
  type Logger,
  type RabbitMqBus,
} from '@lilochat/nest-shared';
import { PersistMessageUseCase } from './application/persist-message.usecase.js';
import { CHAT_CONFIG, chatEnvSchema, type ChatConfig } from './config.js';
import { MessagesController } from './infrastructure/http/messages.controller.js';
import { PrismaMessageRepository } from './infrastructure/prisma/prisma-message.repository.js';
import { PrismaOutboxClient } from './infrastructure/prisma/prisma-outbox.client.js';
import { PrismaModule } from './infrastructure/prisma/prisma.module.js';
import { PrismaService } from './infrastructure/prisma/prisma.service.js';

export const REDIS = Symbol('REDIS');

@Module({
  imports: [
    TypedConfigModule.forRoot({ token: CHAT_CONFIG, schema: chatEnvSchema }),
    LoggerModule.forRoot({ name: 'chat', pretty: process.env.NODE_ENV === 'development' }),
    MessagingModule.forRootAsync({
      useFactory: (config: ChatConfig) => ({ url: config.RABBITMQ_URL }),
      inject: [CHAT_CONFIG],
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
  controllers: [MessagesController],
  providers: [
    {
      provide: REDIS,
      useFactory: (config: ChatConfig) => createRedisClient(config.REDIS_URL, 'chat-redis'),
      inject: [CHAT_CONFIG],
    },
    {
      provide: PrismaMessageRepository,
      useFactory: (prisma: PrismaService) => new PrismaMessageRepository(prisma),
      inject: [PrismaService],
    },
    {
      provide: PersistMessageUseCase,
      useFactory: (messages: PrismaMessageRepository) => new PersistMessageUseCase({ messages }),
      inject: [PrismaMessageRepository],
    },
  ],
})
export class AppModule implements OnApplicationBootstrap, OnApplicationShutdown {
  private relay: OutboxRelay | null = null;

  constructor(
    @Inject(EVENT_BUS) private readonly bus: RabbitMqBus,
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(REDIS) private readonly redis: Redis,
    @Inject(LOGGER) private readonly logger: Logger,
    @Inject(CHAT_CONFIG) private readonly config: ChatConfig,
    @Inject(PersistMessageUseCase) private readonly persist: PersistMessageUseCase,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    this.relay = new OutboxRelay({
      client: new PrismaOutboxClient(this.prisma),
      bus: this.bus,
      logger: this.logger,
    });
    this.relay.start();

    await bindConsumer(this.bus, {
      queue: this.config.CHAT_CONSUMER_QUEUE,
      bindings: ['chat.message.submitted'],
      schema: chatMessageSubmittedEvent,
      handler: (event) => this.persist.execute(event),
      idempotency: new RedisIdempotencyStore(this.redis, { prefix: 'chat' }),
      logger: this.logger,
    });
  }

  async onApplicationShutdown(): Promise<void> {
    if (this.relay) {
      this.relay.stop();
      await this.relay.tick();
    }
    await this.redis.quit().catch(() => this.redis.disconnect());
  }
}
