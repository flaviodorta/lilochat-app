import type { DomainEvent } from '@lilochat/contracts';
import { outboxRowFrom } from '@lilochat/nest-shared';
import { Prisma, type User as UserRow } from '../../../generated/client/index.js';
import { EmailAlreadyInUseError, NicknameAlreadyInUseError } from '../../domain/errors.js';
import type { UserRepository } from '../../domain/ports.js';
import { User } from '../../domain/user.js';
import type { PrismaService } from './prisma.service.js';

export class PrismaUserRepository implements UserRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(user: User, event: DomainEvent<unknown>): Promise<void> {
    try {
      const outbox = outboxRowFrom(event);
      await this.prisma.$transaction([
        this.prisma.user.create({ data: this.toRow(user) }),
        this.prisma.outboxEvent.create({
          data: { ...outbox, payload: outbox.payload as Prisma.InputJsonValue },
        }),
      ]);
    } catch (error) {
      this.rethrowUniqueViolation(error);
    }
  }

  async update(user: User, event: DomainEvent<unknown>): Promise<void> {
    try {
      const { id, ...data } = this.toRow(user);
      const outbox = outboxRowFrom(event);
      await this.prisma.$transaction([
        this.prisma.user.update({ where: { id }, data }),
        this.prisma.outboxEvent.create({
          data: { ...outbox, payload: outbox.payload as Prisma.InputJsonValue },
        }),
      ]);
    } catch (error) {
      this.rethrowUniqueViolation(error);
    }
  }

  async findById(id: string): Promise<User | null> {
    return this.toDomain(await this.prisma.user.findUnique({ where: { id } }));
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.toDomain(await this.prisma.user.findUnique({ where: { email } }));
  }

  async findByNickname(nickname: string): Promise<User | null> {
    return this.toDomain(await this.prisma.user.findUnique({ where: { nickname } }));
  }

  private toRow(user: User) {
    return {
      id: user.id,
      email: user.email,
      passwordHash: user.passwordHash,
      nickname: user.nickname,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  private toDomain(row: UserRow | null): User | null {
    return row ? User.reconstitute({ ...row }) : null;
  }

  /** Concurrent registrations slip past the use case's pre-checks; the DB unique
   *  constraints are the real guard — map them back to domain errors. */
  private rethrowUniqueViolation(error: unknown): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const target = (error.meta?.target as string[] | undefined) ?? [];
      if (target.includes('email')) throw new EmailAlreadyInUseError();
      if (target.includes('nickname')) throw new NicknameAlreadyInUseError();
    }
    throw error;
  }
}
