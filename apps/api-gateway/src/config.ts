import { z } from 'zod';

export const gatewayEnvSchema = z.object({
  PORT: z.coerce.number().int().positive().default(4100),
  IDENTITY_SERVICE_URL: z.string().url(),
  ROOMS_SERVICE_URL: z.string().url(),
  PLAYBACK_SERVICE_URL: z.string().url(),
  REDIS_URL: z.string().min(1),
  /** base64-encoded SPKI PEM — the verify half of identity's RS256 pair. */
  JWT_PUBLIC_KEY: z.string().min(1),
  CORS_ORIGINS: z.string().default('http://localhost:3000'),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  RATE_LIMIT_ANON_CAPACITY: z.coerce.number().positive().default(30),
  RATE_LIMIT_ANON_REFILL_PER_SEC: z.coerce.number().positive().default(0.5),
  RATE_LIMIT_AUTH_CAPACITY: z.coerce.number().positive().default(120),
  RATE_LIMIT_AUTH_REFILL_PER_SEC: z.coerce.number().positive().default(2),
  MULTIAVATAR_API_URL: z.string().url().default('https://api.multiavatar.com'),
  MULTIAVATAR_API_KEY: z.string().optional(),
  AVATAR_CACHE_TTL_SEC: z.coerce
    .number()
    .int()
    .positive()
    .default(30 * 24 * 60 * 60),
});

export type GatewayConfig = z.infer<typeof gatewayEnvSchema>;

export const GATEWAY_CONFIG: unique symbol = Symbol('GATEWAY_CONFIG');
