import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { loadEnv } from './typed-config.js';

const schema = z.object({
  PORT: z.coerce.number().int().positive(),
  DATABASE_URL: z.string().url(),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn']).default('info'),
});

describe('loadEnv', () => {
  it('parses and coerces a valid environment', () => {
    const env = loadEnv(schema, {
      PORT: '3000',
      DATABASE_URL: 'postgresql://localhost:5432/db',
    });
    expect(env.PORT).toBe(3000);
    expect(env.LOG_LEVEL).toBe('info');
  });

  it('fails fast listing every invalid variable', () => {
    expect(() => loadEnv(schema, { PORT: 'abc' })).toThrowError(
      /Invalid environment configuration:[\s\S]*PORT[\s\S]*DATABASE_URL/,
    );
  });
});
