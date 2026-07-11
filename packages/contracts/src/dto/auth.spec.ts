import { describe, expect, it } from 'vitest';
import { nicknameSchema, registerBodySchema } from './auth.js';

describe('nicknameSchema', () => {
  it('accepts url-safe nicknames between 3 and 20 chars', () => {
    expect(nicknameSchema.safeParse('flavio_dev').success).toBe(true);
    expect(nicknameSchema.safeParse('abc').success).toBe(true);
    expect(nicknameSchema.safeParse('a'.repeat(20)).success).toBe(true);
  });

  it('rejects invalid nicknames', () => {
    expect(nicknameSchema.safeParse('ab').success).toBe(false); // too short
    expect(nicknameSchema.safeParse('a'.repeat(21)).success).toBe(false); // too long
    expect(nicknameSchema.safeParse('has space').success).toBe(false);
    expect(nicknameSchema.safeParse('emoji🎬').success).toBe(false);
    expect(nicknameSchema.safeParse('dash-ed').success).toBe(false);
  });
});

describe('registerBodySchema', () => {
  const valid = { email: 'a@b.com', password: 'supersecret', nickname: 'flavio' };

  it('accepts a valid body', () => {
    expect(registerBodySchema.safeParse(valid).success).toBe(true);
  });

  it('rejects short passwords and bad emails', () => {
    expect(registerBodySchema.safeParse({ ...valid, password: 'short' }).success).toBe(false);
    expect(registerBodySchema.safeParse({ ...valid, email: 'not-an-email' }).success).toBe(false);
  });

  it('strips unknown fields', () => {
    const parsed = registerBodySchema.parse({ ...valid, role: 'admin' });
    expect(parsed).not.toHaveProperty('role');
  });
});
