import type { Clock, RefreshTokenGenerator, RefreshTokenRepository } from '../domain/ports.js';

export interface LogoutInput {
  refreshToken: string;
}

/** Idempotent: logging out with an unknown/expired token is a successful no-op. */
export class LogoutUseCase {
  constructor(
    private readonly deps: {
      refreshTokens: RefreshTokenRepository;
      generator: RefreshTokenGenerator;
      clock: Clock;
    },
  ) {}

  async execute(input: LogoutInput): Promise<void> {
    const { refreshTokens, generator, clock } = this.deps;
    const record = await refreshTokens.findByTokenHash(generator.hash(input.refreshToken));
    if (record) {
      await refreshTokens.revokeFamily(record.familyId, clock.now());
    }
  }
}
