import { describe, expect, it } from 'vitest';
import { InvalidNicknameError } from './errors.js';
import { User } from './user.js';

const base = {
  id: '00000000-0000-4000-8000-000000000001',
  email: '  Flavio@Example.COM ',
  passwordHash: 'hash',
  nickname: 'flavio',
  now: new Date('2026-07-10T12:00:00Z'),
};

describe('User.create', () => {
  it('normalizes the email (trim + lowercase)', () => {
    expect(User.create(base).email).toBe('flavio@example.com');
  });

  it('trims the nickname', () => {
    expect(User.create({ ...base, nickname: '  flavio  ' }).nickname).toBe('flavio');
  });

  it('rejects invalid nicknames', () => {
    expect(() => User.create({ ...base, nickname: 'ab' })).toThrow(InvalidNicknameError);
    expect(() => User.create({ ...base, nickname: 'has space' })).toThrow(InvalidNicknameError);
    expect(() => User.create({ ...base, nickname: 'a'.repeat(21) })).toThrow(InvalidNicknameError);
  });

  it('stamps createdAt/updatedAt with the provided clock time', () => {
    const user = User.create(base);
    expect(user.createdAt).toEqual(base.now);
    expect(user.updatedAt).toEqual(base.now);
  });
});

describe('User.changeNickname', () => {
  it('updates nickname and updatedAt, keeps createdAt', () => {
    const user = User.create(base);
    const later = new Date('2026-07-11T08:00:00Z');
    user.changeNickname('new_nick', later);
    expect(user.nickname).toBe('new_nick');
    expect(user.updatedAt).toEqual(later);
    expect(user.createdAt).toEqual(base.now);
  });

  it('enforces the same invariants as creation', () => {
    const user = User.create(base);
    expect(() => user.changeNickname('x', new Date())).toThrow(InvalidNicknameError);
  });
});

describe('User.toProfile', () => {
  it('exposes only public fields with ISO dates', () => {
    const profile = User.create(base).toProfile();
    expect(profile).toEqual({
      id: base.id,
      email: 'flavio@example.com',
      nickname: 'flavio',
      createdAt: '2026-07-10T12:00:00.000Z',
    });
  });
});
