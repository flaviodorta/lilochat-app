import { z } from 'zod';

export const playbackEnvSchema = z.object({
  PORT: z.coerce.number().int().positive().default(4103),
  PLAYBACK_DATABASE_URL: z.string().url(),
  RABBITMQ_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  /** Server-side only — never NEXT_PUBLIC_ (legacy lesson). Optional at boot:
   *  without it the service runs and add-video degrades to a clear 503
   *  (VIDEO_METADATA_UNAVAILABLE) — dev keeps working, prod sets it. */
  YOUTUBE_API_KEY: z.string().default(''),
  YOUTUBE_API_URL: z.string().url().default('https://www.googleapis.com/youtube/v3'),
  /** Buffering-tail grace before auto-advance (§6.2). */
  ADVANCE_GRACE_MS: z.coerce.number().int().nonnegative().default(1500),
  MAX_VIDEO_DURATION_S: z.coerce
    .number()
    .int()
    .positive()
    .default(4 * 60 * 60),
  ADVANCE_QUEUE_NAME: z.string().default('playback-advance'),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
});

export type PlaybackConfig = z.infer<typeof playbackEnvSchema>;

export const PLAYBACK_CONFIG: unique symbol = Symbol('PLAYBACK_CONFIG');
