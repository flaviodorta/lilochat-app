import { Inject, Module, type OnApplicationShutdown } from '@nestjs/common';
import { createRedisClient } from '@lilochat/nest-shared';
import type { Redis } from 'ioredis';
import { GATEWAY_CONFIG, type GatewayConfig } from '../config.js';

export const REDIS = Symbol('REDIS');

@Module({
  providers: [
    {
      provide: REDIS,
      useFactory: (config: GatewayConfig) => createRedisClient(config.REDIS_URL, 'gateway-redis'),
      inject: [GATEWAY_CONFIG],
    },
  ],
  exports: [REDIS],
})
export class RedisModule implements OnApplicationShutdown {
  constructor(@Inject(REDIS) private readonly redis: Redis) {}

  async onApplicationShutdown(): Promise<void> {
    await this.redis.quit().catch(() => this.redis.disconnect());
  }
}
