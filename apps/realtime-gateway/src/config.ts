import { z } from 'zod';

export const rtgEnvSchema = z.object({
  PORT: z.coerce.number().int().positive().default(4110),
  REDIS_URL: z.string().min(1),
  RABBITMQ_URL: z.string().min(1),
  /** RS256 verify half — same pair as the api-gateway. */
  JWT_PUBLIC_KEY: z.string().min(1),
  CORS_ORIGINS: z.string().default('http://localhost:3000'),
  /** Load shedding (CLAUDE.md §9.1): shed BEFORE saturation, with a clear error. */
  MAX_CONNECTIONS: z.coerce.number().int().positive().default(5000),
  MAX_ROOM_JOINS: z.coerce.number().int().positive().default(200),
  /** Overridable so integration tests get isolated queues. */
  RTG_CONSUMER_QUEUE: z.string().default('rtg.playback-events'),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
});

export type RtgConfig = z.infer<typeof rtgEnvSchema>;

export const RTG_CONFIG: unique symbol = Symbol('RTG_CONFIG');
