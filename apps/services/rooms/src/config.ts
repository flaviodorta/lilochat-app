import { z } from 'zod';

export const roomsEnvSchema = z.object({
  PORT: z.coerce.number().int().positive().default(4102),
  ROOMS_DATABASE_URL: z.string().url(),
  RABBITMQ_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  /** Overridable so integration tests get isolated queues. */
  ROOMS_CONSUMER_QUEUE: z.string().default('rooms.playback-events'),
  ROOMS_PRESENCE_QUEUE: z.string().default('rooms.presence-events'),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
});

export type RoomsConfig = z.infer<typeof roomsEnvSchema>;

export const ROOMS_CONFIG: unique symbol = Symbol('ROOMS_CONFIG');
