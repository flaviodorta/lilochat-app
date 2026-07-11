import { Module } from '@nestjs/common';
import { Inject, type OnApplicationBootstrap, type OnApplicationShutdown } from '@nestjs/common';
import {
  EVENT_BUS,
  HealthModule,
  LoggerModule,
  MessagingModule,
  OutboxRelay,
  TypedConfigModule,
  LOGGER,
  type Logger,
  type RabbitMqBus,
} from '@lilochat/nest-shared';
import { PrismaOutboxClient } from './infrastructure/prisma/prisma-outbox.client.js';
import { IDENTITY_CONFIG, identityEnvSchema, type IdentityConfig } from './config.js';
import { IdentityModule } from './infrastructure/identity.module.js';
import { PrismaModule } from './infrastructure/prisma/prisma.module.js';
import { PrismaService } from './infrastructure/prisma/prisma.service.js';

@Module({
  imports: [
    TypedConfigModule.forRoot({ token: IDENTITY_CONFIG, schema: identityEnvSchema }),
    MessagingModule.forRootAsync({
      useFactory: (config: IdentityConfig) => ({ url: config.RABBITMQ_URL }),
      inject: [IDENTITY_CONFIG],
    }),
    LoggerModule.forRoot({ name: 'identity', pretty: process.env.NODE_ENV === 'development' }),
    PrismaModule,
    IdentityModule,
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
})
export class AppModule implements OnApplicationBootstrap, OnApplicationShutdown {
  private relay: OutboxRelay | null = null;

  constructor(
    @Inject(EVENT_BUS) private readonly bus: RabbitMqBus,
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(LOGGER) private readonly logger: Logger,
  ) {}

  onApplicationBootstrap(): void {
    this.relay = new OutboxRelay({
      client: new PrismaOutboxClient(this.prisma),
      bus: this.bus,
      logger: this.logger,
    });
    this.relay.start();
  }

  async onApplicationShutdown(): Promise<void> {
    if (this.relay) {
      this.relay.stop();
      await this.relay.tick();
    }
  }
}
