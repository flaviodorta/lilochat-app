import { createHash } from 'node:crypto';
import {
  HttpException,
  Inject,
  Injectable,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import type { Redis } from 'ioredis';
import { LOGGER, type Logger } from '@lilochat/nest-shared';
import { GATEWAY_CONFIG, type GatewayConfig } from '../config.js';
import { REDIS } from '../redis/redis.module.js';
import { TokenBucket, type BucketPolicy } from '@lilochat/nest-shared';
import { ROUTE_BUCKET, type RouteBucketPolicy } from './route-bucket.decorator.js';

/**
 * Global admission control. Key: hash of the bearer token when present (cheap,
 * no signature check needed just to bucket), source IP otherwise. Health probes skip.
 * Handlers tagged with @RouteBucket get a SECOND, route-scoped bucket on top
 * (§9.1 — e.g. queue-add 5/min), so the generic allowance can't be spent
 * hammering one expensive endpoint.
 * Redis outage → fail-open with a warning: availability beats strictness here,
 * and the SLO dashboard alerts on the warn rate (deliberate trade-off).
 */
@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly bucket: TokenBucket;
  private readonly anonPolicy: BucketPolicy;
  private readonly authPolicy: BucketPolicy;

  constructor(
    @Inject(REDIS) redis: Redis,
    @Inject(GATEWAY_CONFIG) config: GatewayConfig,
    @Inject(LOGGER) private readonly logger: Logger,
    // explicit @Inject: tsx/esbuild doesn't emit design:paramtypes metadata
    @Inject(Reflector) private readonly reflector: Reflector,
  ) {
    this.bucket = new TokenBucket(redis);
    this.anonPolicy = {
      capacity: config.RATE_LIMIT_ANON_CAPACITY,
      refillPerSec: config.RATE_LIMIT_ANON_REFILL_PER_SEC,
    };
    this.authPolicy = {
      capacity: config.RATE_LIMIT_AUTH_CAPACITY,
      refillPerSec: config.RATE_LIMIT_AUTH_REFILL_PER_SEC,
    };
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    if (request.path.startsWith('/health')) return true;

    const bearer = request.headers.authorization?.replace(/^Bearer\s+/i, '');
    const key = bearer
      ? `tok:${createHash('sha256').update(bearer).digest('hex').slice(0, 32)}`
      : `ip:${request.ip ?? 'unknown'}`;
    const policy = bearer ? this.authPolicy : this.anonPolicy;

    const routePolicy = this.reflector.get<RouteBucketPolicy | undefined>(
      ROUTE_BUCKET,
      context.getHandler(),
    );

    let allowed: boolean;
    try {
      allowed = await this.bucket.consume(key, policy);
      if (allowed && routePolicy) {
        allowed = await this.bucket.consume(`route:${routePolicy.tag}:${key}`, routePolicy);
      }
    } catch (error) {
      this.logger.warn({ err: error }, 'rate limiter unavailable — failing open');
      return true;
    }

    if (!allowed) {
      throw new HttpException(
        { statusCode: 429, code: 'RATE_LIMITED', message: 'Too many requests' },
        429,
      );
    }
    return true;
  }
}
