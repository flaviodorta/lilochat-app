import { Inject, Module, type OnApplicationShutdown } from '@nestjs/common';
import { Redis } from 'ioredis';
import { GATEWAY_CONFIG, type GatewayConfig } from '../config.js';

export const REDIS = Symbol('REDIS');

@Module({
  providers: [
    {
      provide: REDIS,
      useFactory: (config: GatewayConfig) =>
        new Redis(config.REDIS_URL, { maxRetriesPerRequest: 1 }),
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
