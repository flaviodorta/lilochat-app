import type { User } from './user.js';

// ── Driven ports (hexagonal): implemented by infrastructure adapters ──────────

export interface PasswordHasher {
  hash(plain: string): Promise<string>;
  verify(hash: string, plain: string): Promise<boolean>;
}

export interface UserRepository {
  create(user: User): Promise<void>;
  update(user: User): Promise<void>;
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  findByNickname(nickname: string): Promise<User | null>;
}

export interface RefreshTokenRecord {
  id: string;
  userId: string;
  tokenHash: string;
  familyId: string;
  expiresAt: Date;
  rotatedAt: Date | null;
  revokedAt: Date | null;
}

export interface RefreshTokenRepository {
  create(record: Omit<RefreshTokenRecord, 'rotatedAt' | 'revokedAt'>): Promise<void>;
  findByTokenHash(tokenHash: string): Promise<RefreshTokenRecord | null>;
  markRotated(id: string, at: Date): Promise<void>;
  revokeFamily(familyId: string, at: Date): Promise<void>;
}

export interface AccessTokenSigner {
  sign(payload: {
    sub: string;
    nickname: string;
  }): Promise<{ token: string; expiresInSec: number }>;
}

/** Refresh tokens are opaque random strings; only their sha256 hash is stored. */
export interface RefreshTokenGenerator {
  generate(): { plain: string; hash: string };
  hash(plain: string): string;
}

export interface Clock {
  now(): Date;
}

export interface IdGenerator {
  next(): string;
}
