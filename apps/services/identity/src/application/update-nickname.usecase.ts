import type { UserProfile } from '@lilochat/contracts';
import { NicknameAlreadyInUseError, UserNotFoundError } from '../domain/errors.js';
import type { Clock, UserRepository } from '../domain/ports.js';

export interface UpdateNicknameInput {
  userId: string;
  nickname: string;
}

export class UpdateNicknameUseCase {
  constructor(private readonly deps: { users: UserRepository; clock: Clock }) {}

  async execute(input: UpdateNicknameInput): Promise<UserProfile> {
    const { users, clock } = this.deps;

    const user = await users.findById(input.userId);
    if (!user) throw new UserNotFoundError();

    const nickname = input.nickname.trim();
    if (nickname === user.nickname) return user.toProfile(); // no-op

    const taken = await users.findByNickname(nickname);
    if (taken && taken.id !== user.id) throw new NicknameAlreadyInUseError();

    user.changeNickname(nickname, clock.now());
    await users.update(user);
    // TODO(phase-2): publish identity.user.updated via the transactional outbox
    // so read models (chat nicknames, room cards) converge.

    return user.toProfile();
  }
}
