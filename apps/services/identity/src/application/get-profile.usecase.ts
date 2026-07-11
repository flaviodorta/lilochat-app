import type { UserProfile } from '@lilochat/contracts';
import { UserNotFoundError } from '../domain/errors.js';
import type { UserRepository } from '../domain/ports.js';

export class GetProfileUseCase {
  constructor(private readonly deps: { users: UserRepository }) {}

  async execute(userId: string): Promise<UserProfile> {
    const user = await this.deps.users.findById(userId);
    if (!user) throw new UserNotFoundError();
    return user.toProfile();
  }
}
