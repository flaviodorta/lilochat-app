import { EmailAlreadyInUseError, NicknameAlreadyInUseError } from '../domain/errors.js';
import type { Clock, IdGenerator, PasswordHasher, UserRepository } from '../domain/ports.js';
import { User } from '../domain/user.js';
import type { AuthSession } from './auth-session.js';
import type { TokenIssuer } from './token-issuer.js';

export interface RegisterInput {
  email: string;
  password: string;
  nickname: string;
}

export class RegisterUseCase {
  constructor(
    private readonly deps: {
      users: UserRepository;
      hasher: PasswordHasher;
      tokens: TokenIssuer;
      clock: Clock;
      ids: IdGenerator;
    },
  ) {}

  async execute(input: RegisterInput): Promise<AuthSession> {
    const { users, hasher, tokens, clock, ids } = this.deps;

    const email = User.normalizeEmail(input.email);
    if (await users.findByEmail(email)) throw new EmailAlreadyInUseError();
    if (await users.findByNickname(input.nickname.trim())) throw new NicknameAlreadyInUseError();

    const user = User.create({
      id: ids.next(),
      email,
      passwordHash: await hasher.hash(input.password),
      nickname: input.nickname,
      now: clock.now(),
    });
    // Uniqueness is re-enforced by DB constraints: the repository maps unique
    // violations (concurrent registrations) back to these same domain errors.
    await users.create(user);
    // TODO(phase-2): publish identity.user.registered via the transactional outbox.

    return { user: user.toProfile(), ...(await tokens.issueNewFamily(user)) };
  }
}
