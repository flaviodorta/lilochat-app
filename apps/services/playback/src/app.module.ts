import { Module } from '@nestjs/common';
import {
  HealthModule,
  LoggerModule,
  MessagingModule,
  TypedConfigModule,
} from '@lilochat/nest-shared';
import { PLAYBACK_CONFIG, playbackEnvSchema, type PlaybackConfig } from './config.js';
import { PlaybackModule } from './infrastructure/playback.module.js';
import { PrismaModule } from './infrastructure/prisma/prisma.module.js';
import { PrismaService } from './infrastructure/prisma/prisma.service.js';

@Module({
  imports: [
    TypedConfigModule.forRoot({ token: PLAYBACK_CONFIG, schema: playbackEnvSchema }),
    LoggerModule.forRoot({ name: 'playback', pretty: process.env.NODE_ENV === 'development' }),
    MessagingModule.forRootAsync({
      useFactory: (config: PlaybackConfig) => ({ url: config.RABBITMQ_URL }),
      inject: [PLAYBACK_CONFIG],
    }),
    PrismaModule,
    PlaybackModule,
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
export class AppModule {}
