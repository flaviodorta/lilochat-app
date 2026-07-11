import type {
  AccessTokenSigner,
  Clock,
  IdGenerator,
  PasswordHasher,
  RefreshTokenGenerator,
  RefreshTokenRecord,
  RefreshTokenRepository,
  UserRepository,
} from '../domain/ports.js';
import type { User } from '../domain/user.js';
import { TokenIssuer } from '../application/token-issuer.js';

export class FakeUserRepository implements UserRepository {
  readonly byId = new Map<string, User>();

  async create(user: User): Promise<void> {
    this.byId.set(user.id, user);
  }
  async update(user: User): Promise<void> {
    this.byId.set(user.id, user);
  }
  async findById(id: string): Promise<User | null> {
    return this.byId.get(id) ?? null;
  }
  async findByEmail(email: string): Promise<User | null> {
    return [...this.byId.values()].find((u) => u.email === email) ?? null;
  }
  async findByNickname(nickname: string): Promise<User | null> {
    return [...this.byId.values()].find((u) => u.nickname === nickname) ?? null;
  }
}

export class FakeRefreshTokenRepository implements RefreshTokenRepository {
  readonly records = new Map<string, RefreshTokenRecord>();

  async create(record: Omit<RefreshTokenRecord, 'rotatedAt' | 'revokedAt'>): Promise<void> {
    this.records.set(record.id, { ...record, rotatedAt: null, revokedAt: null });
  }
  async findByTokenHash(tokenHash: string): Promise<RefreshTokenRecord | null> {
    return [...this.records.values()].find((r) => r.tokenHash === tokenHash) ?? null;
  }
  async markRotated(id: string, at: Date): Promise<void> {
    const record = this.records.get(id);
    if (record) record.rotatedAt = at;
  }
  async revokeFamily(familyId: string, at: Date): Promise<void> {
    for (const record of this.records.values()) {
      if (record.familyId === familyId && !record.revokedAt) record.revokedAt = at;
    }
  }
}

/** Reversible fake — never use outside tests. */
export class FakePasswordHasher implements PasswordHasher {
  async hash(plain: string): Promise<string> {
    return `hashed:${plain}`;
  }
  async verify(hash: string, plain: string): Promise<boolean> {
    return hash === `hashed:${plain}`;
  }
}

export class FakeAccessTokenSigner implements AccessTokenSigner {
  async sign(payload: { sub: string; nickname: string }) {
    return { token: `jwt:${payload.sub}:${payload.nickname}`, expiresInSec: 900 };
  }
}

export class FakeRefreshTokenGenerator implements RefreshTokenGenerator {
  private counter = 0;
  generate(): { plain: string; hash: string } {
    const plain = `refresh-${++this.counter}`;
    return { plain, hash: this.hash(plain) };
  }
  hash(plain: string): string {
    return `sha256:${plain}`;
  }
}

export class FixedClock implements Clock {
  constructor(private current = new Date('2026-07-10T12:00:00.000Z')) {}
  now(): Date {
    return new Date(this.current);
  }
  advanceMs(ms: number): void {
    this.current = new Date(this.current.getTime() + ms);
  }
}

export class SequentialIdGenerator implements IdGenerator {
  private counter = 0;
  next(): string {
    // Valid uuid shape, deterministic suffix — keeps profile schemas parseable.
    return `00000000-0000-4000-8000-${String(++this.counter).padStart(12, '0')}`;
  }
}

export interface TestContext {
  users: FakeUserRepository;
  refreshTokens: FakeRefreshTokenRepository;
  hasher: FakePasswordHasher;
  signer: FakeAccessTokenSigner;
  generator: FakeRefreshTokenGenerator;
  clock: FixedClock;
  ids: SequentialIdGenerator;
  tokens: TokenIssuer;
}

export function makeTestContext(overrides: { refreshTtlDays?: number } = {}): TestContext {
  const users = new FakeUserRepository();
  const refreshTokens = new FakeRefreshTokenRepository();
  const hasher = new FakePasswordHasher();
  const signer = new FakeAccessTokenSigner();
  const generator = new FakeRefreshTokenGenerator();
  const clock = new FixedClock();
  const ids = new SequentialIdGenerator();
  const tokens = new TokenIssuer({
    signer,
    refreshTokens,
    generator,
    clock,
    ids,
    refreshTtlDays: overrides.refreshTtlDays ?? 30,
  });
  return { users, refreshTokens, hasher, signer, generator, clock, ids, tokens };
}
