import type { Redis } from 'ioredis';

/**
 * Token-bucket admission control in Redis (CLAUDE.md §9.1) — atomic via Lua:
 * refill proportional to elapsed time, capped at capacity; one round-trip per check.
 * Shared across gateway instances because the bucket state lives in Redis.
 */
const TOKEN_BUCKET_LUA = `
local key = KEYS[1]
local capacity = tonumber(ARGV[1])
local refill_per_ms = tonumber(ARGV[2])
local now = tonumber(ARGV[3])
local cost = tonumber(ARGV[4])
local ttl_ms = tonumber(ARGV[5])

local state = redis.call('HMGET', key, 'tokens', 'ts')
local tokens = tonumber(state[1])
local ts = tonumber(state[2])
if tokens == nil or ts == nil then
  tokens = capacity
  ts = now
end

tokens = math.min(capacity, tokens + math.max(0, now - ts) * refill_per_ms)

local allowed = 0
if tokens >= cost then
  tokens = tokens - cost
  allowed = 1
end

redis.call('HSET', key, 'tokens', tokens, 'ts', now)
redis.call('PEXPIRE', key, ttl_ms)
return allowed
`;

export interface BucketPolicy {
  capacity: number;
  refillPerSec: number;
}

export class TokenBucket {
  constructor(private readonly redis: Redis) {}

  /** Returns true when the request is admitted. */
  async consume(key: string, policy: BucketPolicy, cost = 1): Promise<boolean> {
    const ttlMs = Math.ceil((policy.capacity / policy.refillPerSec) * 1000) + 60_000;
    const allowed = (await this.redis.eval(
      TOKEN_BUCKET_LUA,
      1,
      `ratelimit:${key}`,
      policy.capacity,
      policy.refillPerSec / 1000,
      Date.now(),
      cost,
      ttlMs,
    )) as number;
    return allowed === 1;
  }
}
