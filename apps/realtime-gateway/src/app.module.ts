import { Module } from '@nestjs/common';
import type { Redis } from 'ioredis';
import {
  createRedisClient,
  HealthModule,
  LoggerModule,
  MessagingModule,
  TypedConfigModule,
} from '@lilochat/nest-shared';
import { RTG_CONFIG, rtgEnvSchema, type RtgConfig } from './config.js';

export const REDIS = Symbol('REDIS');

@Module({
  providers: [
    {
      provide: REDIS,
      useFactory: (config: RtgConfig) => createRedisClient(config.REDIS_URL, 'rtg-redis'),
      inject: [RTG_CONFIG],
    },
  ],
  exports: [REDIS],
})
export class HealthRedisModule {}

@Module({
  imports: [
    TypedConfigModule.forRoot({ token: RTG_CONFIG, schema: rtgEnvSchema }),
    LoggerModule.forRoot({
      name: 'realtime-gateway',
      pretty: process.env.NODE_ENV === 'development',
    }),
    MessagingModule.forRootAsync({
      useFactory: (config: RtgConfig) => ({ url: config.RABBITMQ_URL }),
      inject: [RTG_CONFIG],
    }),
    HealthModule.forRoot({
      imports: [HealthRedisModule],
      checks: {
        useFactory: (redis: Redis) => [
          {
            name: 'redis',
            check: async () => {
              await redis.ping();
            },
          },
        ],
        inject: [REDIS],
      },
    }),
  ],
})
export class AppModule {}
