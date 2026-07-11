import { z } from 'zod';

export const identityEnvSchema = z.object({
  PORT: z.coerce.number().int().positive().default(4101),
  IDENTITY_DATABASE_URL: z.string().url(),
  /** base64-encoded PKCS8 PEM (RS256) — generate with `pnpm gen:keys`. */
  JWT_PRIVATE_KEY: z.string().min(1),
  ACCESS_TOKEN_TTL_SEC: z.coerce.number().int().positive().default(900), // 15 min
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(30),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
});

export type IdentityConfig = z.infer<typeof identityEnvSchema>;

export const IDENTITY_CONFIG: unique symbol = Symbol('IDENTITY_CONFIG');
