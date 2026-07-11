import { InvalidCredentialsError } from '../domain/errors.js';
import type { PasswordHasher, UserRepository } from '../domain/ports.js';
import { User } from '../domain/user.js';
import type { AuthSession } from './auth-session.js';
import type { TokenIssuer } from './token-issuer.js';

export interface LoginInput {
  email: string;
  password: string;
}

export class LoginUseCase {
  constructor(
    private readonly deps: {
      users: UserRepository;
      hasher: PasswordHasher;
      tokens: TokenIssuer;
    },
  ) {}

  async execute(input: LoginInput): Promise<AuthSession> {
    const { users, hasher, tokens } = this.deps;

    const user = await users.findByEmail(User.normalizeEmail(input.email));
    if (!user) throw new InvalidCredentialsError();
    if (!(await hasher.verify(user.passwordHash, input.password))) {
      throw new InvalidCredentialsError();
    }

    return { user: user.toProfile(), ...(await tokens.issueNewFamily(user)) };
  }
}
