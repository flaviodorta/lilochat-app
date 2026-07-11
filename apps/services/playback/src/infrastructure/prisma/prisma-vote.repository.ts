import type { DomainEvent } from '@lilochat/contracts';
import { outboxRowFrom } from '@lilochat/nest-shared';
import type { Prisma } from '../../../generated/client/index.js';
import type { VoteRecord, VoteRepository } from '../../domain/ports.js';
import type { PrismaService } from './prisma.service.js';

export class PrismaVoteRepository implements VoteRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createWithEvents(vote: VoteRecord, events: DomainEvent<unknown>[]): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.vote.create({ data: vote }),
      ...this.outboxCreates(events),
    ]);
  }

  async findOpen(roomId: string): Promise<VoteRecord | null> {
    return this.prisma.vote.findFirst({ where: { roomId, result: null } });
  }

  async findById(voteId: string): Promise<VoteRecord | null> {
    return this.prisma.vote.findUnique({ where: { id: voteId } });
  }

  async setResultWithEvents(
    voteId: string,
    result: 'PASSED' | 'FAILED',
    events: DomainEvent<unknown>[],
  ): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.vote.update({ where: { id: voteId }, data: { result } }),
      ...this.outboxCreates(events),
    ]);
  }

  async appendEvents(events: DomainEvent<unknown>[]): Promise<void> {
    await this.prisma.$transaction(this.outboxCreates(events));
  }

  private outboxCreates(events: DomainEvent<unknown>[]) {
    return events.map((event) => {
      const row = outboxRowFrom(event);
      return this.prisma.outboxEvent.create({
        data: { ...row, payload: row.payload as Prisma.InputJsonValue },
      });
    });
  }
}
