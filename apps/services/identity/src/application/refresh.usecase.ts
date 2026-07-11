import { InvalidRefreshTokenError, RefreshTokenReuseError } from '../domain/errors.js';
import type {
  Clock,
  RefreshTokenGenerator,
  RefreshTokenRepository,
  UserRepository,
} from '../domain/ports.js';
import type { AuthSession } from './auth-session.js';
import type { TokenIssuer } from './token-issuer.js';

export interface RefreshInput {
  refreshToken: string;
}

/**
 * Rotation with reuse detection (CLAUDE.md §9.2): each refresh token is single-use.
 * Presenting an already-rotated token means it leaked (or a race) — the whole
 * family is revoked, forcing a fresh login on every device holding that chain.
 */
export class RefreshUseCase {
  constructor(
    private readonly deps: {
      users: UserRepository;
      refreshTokens: RefreshTokenRepository;
      generator: RefreshTokenGenerator;
      tokens: TokenIssuer;
      clock: Clock;
    },
  ) {}

  async execute(input: RefreshInput): Promise<AuthSession> {
    const { users, refreshTokens, generator, tokens, clock } = this.deps;

    const record = await refreshTokens.findByTokenHash(generator.hash(input.refreshToken));
    if (!record) throw new InvalidRefreshTokenError();

    const now = clock.now();
    if (record.revokedAt) throw new InvalidRefreshTokenError();
    if (record.expiresAt.getTime() <= now.getTime()) throw new InvalidRefreshTokenError();

    if (record.rotatedAt) {
      await refreshTokens.revokeFamily(record.familyId, now);
      throw new RefreshTokenReuseError();
    }

    const user = await users.findById(record.userId);
    if (!user) throw new InvalidRefreshTokenError();

    await refreshTokens.markRotated(record.id, now);
    return { user: user.toProfile(), ...(await tokens.issueInFamily(user, record.familyId)) };
  }
}
