import multiavatar from '@multiavatar/multiavatar';
import { Inject, Injectable } from '@nestjs/common';
import type { Redis } from 'ioredis';
import { LOGGER, type Logger } from '@lilochat/nest-shared';
import { GATEWAY_CONFIG, type GatewayConfig } from '../config.js';
import { REDIS } from '../redis/redis.module.js';
import { CircuitBreaker } from '../resilience/circuit-breaker.js';

/**
 * Avatar pipeline (ADR-008): Redis cache-aside → Multiavatar HTTP API behind a
 * circuit breaker → local generation via the official npm lib as fallback.
 * The fallback produces IDENTICAL avatars, so users never see the degradation.
 */
@Injectable()
export class AvatarService {
  private readonly breaker = new CircuitBreaker({ failureThreshold: 3, openMs: 30_000 });
  private readonly apiUrl: string;
  private readonly apiKey?: string;
  private readonly cacheTtlSec: number;

  constructor(
    @Inject(REDIS) private readonly redis: Redis,
    @Inject(GATEWAY_CONFIG) config: GatewayConfig,
    @Inject(LOGGER) private readonly logger: Logger,
  ) {
    this.apiUrl = config.MULTIAVATAR_API_URL.replace(/\/$/, '');
    this.apiKey = config.MULTIAVATAR_API_KEY;
    this.cacheTtlSec = config.AVATAR_CACHE_TTL_SEC;
  }

  async getSvg(seed: string): Promise<string> {
    const cacheKey = `avatar:${seed}`;
    const cached = await this.redis.get(cacheKey).catch(() => null);
    if (cached) return cached;

    let svg: string;
    try {
      svg = await this.breaker.execute(() => this.fetchRemote(seed));
    } catch (error) {
      // breaker open or remote down → generate locally (same output, zero dependency)
      this.logger.warn({ err: error, seed }, 'multiavatar API unavailable — generating locally');
      svg = multiavatar(seed);
    }

    await this.redis.set(cacheKey, svg, 'EX', this.cacheTtlSec).catch(() => undefined);
    return svg;
  }

  private async fetchRemote(seed: string): Promise<string> {
    const query = this.apiKey ? `?apikey=${this.apiKey}` : '';
    const response = await fetch(`${this.apiUrl}/${encodeURIComponent(seed)}.svg${query}`, {
      signal: AbortSignal.timeout(3_000),
    });
    if (!response.ok) throw new Error(`multiavatar API responded ${response.status}`);
    const svg = await response.text();
    if (!svg.trimStart().startsWith('<svg')) throw new Error('multiavatar API returned non-SVG');
    return svg;
  }
}
