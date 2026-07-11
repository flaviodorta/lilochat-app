import type {
  AccessTokenSigner,
  Clock,
  IdGenerator,
  RefreshTokenGenerator,
  RefreshTokenRepository,
} from '../domain/ports.js';
import type { User } from '../domain/user.js';

export interface IssuedTokens {
  accessToken: string;
  accessTokenExpiresIn: number;
  refreshToken: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Shared by register/login (new family) and refresh (same family — rotation chain). */
export class TokenIssuer {
  constructor(
    private readonly deps: {
      signer: AccessTokenSigner;
      refreshTokens: RefreshTokenRepository;
      generator: RefreshTokenGenerator;
      clock: Clock;
      ids: IdGenerator;
      refreshTtlDays: number;
    },
  ) {}

  issueNewFamily(user: User): Promise<IssuedTokens> {
    return this.issue(user, this.deps.ids.next());
  }

  issueInFamily(user: User, familyId: string): Promise<IssuedTokens> {
    return this.issue(user, familyId);
  }

  private async issue(user: User, familyId: string): Promise<IssuedTokens> {
    const { signer, refreshTokens, generator, clock, ids, refreshTtlDays } = this.deps;
    const { token, expiresInSec } = await signer.sign({ sub: user.id, nickname: user.nickname });
    const { plain, hash } = generator.generate();
    await refreshTokens.create({
      id: ids.next(),
      userId: user.id,
      tokenHash: hash,
      familyId,
      expiresAt: new Date(clock.now().getTime() + refreshTtlDays * DAY_MS),
    });
    return { accessToken: token, accessTokenExpiresIn: expiresInSec, refreshToken: plain };
  }
}
