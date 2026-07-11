import { Redis, type RedisOptions } from 'ioredis';
import { createLogger } from '../logger/logger.js';

/**
 * The one way to create a Redis client. Two lessons from the 6.5 drill baked
 * in: an unlistened ioredis 'error' event hides outages ("[ioredis] Unhandled
 * error event" spam), and fail-fast commands (maxRetriesPerRequest: 1) are
 * what let call sites implement fail-open instead of hanging. ioredis
 * auto-reconnects and resubscribes pub/sub channels once Redis returns.
 */
export function createRedisClient(url: string, label = 'redis', options: RedisOptions = {}): Redis {
  const client = new Redis(url, { maxRetriesPerRequest: 1, ...options });
  const logger = createLogger({ name: label });
  client.on('error', (error: Error) => logger.warn({ err: error.message }, 'redis error'));
  return client;
}
