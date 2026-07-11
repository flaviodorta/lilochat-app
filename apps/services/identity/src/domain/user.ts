import { nicknameSchema, type UserProfile } from '@lilochat/contracts';
import { InvalidNicknameError } from './errors.js';

export interface UserProps {
  id: string;
  email: string;
  passwordHash: string;
  nickname: string;
  createdAt: Date;
  updatedAt: Date;
}

export class User {
  private constructor(private readonly props: UserProps) {}

  /** New user: normalizes email, enforces nickname invariants. */
  static create(input: {
    id: string;
    email: string;
    passwordHash: string;
    nickname: string;
    now: Date;
  }): User {
    return new User({
      id: input.id,
      email: User.normalizeEmail(input.email),
      passwordHash: input.passwordHash,
      nickname: User.validateNickname(input.nickname),
      createdAt: input.now,
      updatedAt: input.now,
    });
  }

  /** Rehydrate from persistence — trusts stored data, re-validates nothing. */
  static reconstitute(props: UserProps): User {
    return new User({ ...props });
  }

  static normalizeEmail(raw: string): string {
    return raw.trim().toLowerCase();
  }

  private static validateNickname(raw: string): string {
    const result = nicknameSchema.safeParse(raw.trim());
    if (!result.success) {
      throw new InvalidNicknameError(result.error.issues[0]?.message ?? 'Invalid nickname');
    }
    return result.data;
  }

  changeNickname(raw: string, now: Date): void {
    this.props.nickname = User.validateNickname(raw);
    this.props.updatedAt = now;
  }

  get id(): string {
    return this.props.id;
  }
  get email(): string {
    return this.props.email;
  }
  get passwordHash(): string {
    return this.props.passwordHash;
  }
  get nickname(): string {
    return this.props.nickname;
  }
  get createdAt(): Date {
    return this.props.createdAt;
  }
  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  toProfile(): UserProfile {
    return {
      id: this.props.id,
      email: this.props.email,
      nickname: this.props.nickname,
      createdAt: this.props.createdAt.toISOString(),
    };
  }
}
