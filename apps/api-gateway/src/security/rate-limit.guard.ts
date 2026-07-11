import { createHash } from 'node:crypto';
import {
  HttpException,
  Inject,
  Injectable,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import type { Request } from 'express';
import type { Redis } from 'ioredis';
import { LOGGER, type Logger } from '@lilochat/nest-shared';
import { GATEWAY_CONFIG, type GatewayConfig } from '../config.js';
import { REDIS } from '../redis/redis.module.js';
import { TokenBucket, type BucketPolicy } from './token-bucket.js';

/**
 * Global admission control. Key: hash of the bearer token when present (cheap,
 * no signature check needed just to bucket), source IP otherwise. Health probes skip.
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

    let allowed: boolean;
    try {
      allowed = await this.bucket.consume(key, policy);
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
