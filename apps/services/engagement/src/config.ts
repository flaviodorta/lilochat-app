import { z } from 'zod';

export const engagementEnvSchema = z.object({
  PORT: z.coerce.number().int().positive().default(4105),
  ENGAGEMENT_DATABASE_URL: z.string().url(),
  RABBITMQ_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  /** Overridable so integration tests get isolated queues. */
  ENGAGEMENT_QUEUE_PREFIX: z.string().default('engagement'),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
});

export type EngagementConfig = z.infer<typeof engagementEnvSchema>;

export const ENGAGEMENT_CONFIG: unique symbol = Symbol('ENGAGEMENT_CONFIG');
