import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import type { Redis } from 'ioredis';
import { HealthModule, LoggerModule, TypedConfigModule } from '@lilochat/nest-shared';
import { AvatarService } from './avatars/avatar.service.js';
import { AvatarsController } from './avatars/avatars.controller.js';
import { ChatClient } from './clients/chat.client.js';
import { IdentityClient } from './clients/identity.client.js';
import { PlaybackClient } from './clients/playback.client.js';
import { RoomsClient } from './clients/rooms.client.js';
import { GATEWAY_CONFIG, gatewayEnvSchema } from './config.js';
import { AuthController } from './http/auth.controller.js';
import { RoomsController } from './http/rooms.controller.js';
import { UsersController } from './http/users.controller.js';
import { RedisModule, REDIS } from './redis/redis.module.js';
import { JwtAuthGuard } from './security/jwt-auth.guard.js';
import { RateLimitGuard } from './security/rate-limit.guard.js';

@Module({
  imports: [
    TypedConfigModule.forRoot({ token: GATEWAY_CONFIG, schema: gatewayEnvSchema }),
    LoggerModule.forRoot({ name: 'api-gateway', pretty: process.env.NODE_ENV === 'development' }),
    RedisModule,
    HealthModule.forRoot({
      imports: [RedisModule],
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
  controllers: [AuthController, UsersController, AvatarsController, RoomsController],
  providers: [
    IdentityClient,
    RoomsClient,
    PlaybackClient,
    ChatClient,
    AvatarService,
    JwtAuthGuard,
    { provide: APP_GUARD, useClass: RateLimitGuard }, // admission control runs first, on every route
  ],
})
export class AppModule {}
