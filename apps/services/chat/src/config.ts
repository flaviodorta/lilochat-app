import { z } from 'zod';

export const chatEnvSchema = z.object({
  PORT: z.coerce.number().int().positive().default(4104),
  CHAT_DATABASE_URL: z.string().url(),
  RABBITMQ_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  /** Overridable so integration tests get isolated queues. */
  CHAT_CONSUMER_QUEUE: z.string().default('chat.message-submitted'),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
});

export type ChatConfig = z.infer<typeof chatEnvSchema>;

export const CHAT_CONFIG: unique symbol = Symbol('CHAT_CONFIG');
