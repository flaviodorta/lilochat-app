import type { DomainEvent } from '@lilochat/contracts';
import { outboxRowFrom } from '@lilochat/nest-shared';
import type { Prisma } from '../../../generated/client/index.js';
import type { QueueItemRecord, QueueRepository } from '../../domain/ports.js';
import type { PrismaService } from './prisma.service.js';

export class PrismaQueueRepository implements QueueRepository {
  constructor(private readonly prisma: PrismaService) {}

  async insertWithEvents(item: QueueItemRecord, events: DomainEvent<unknown>[]): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.queueItem.create({ data: item }),
      ...this.outboxCreates(events),
    ]);
  }

  async transitionWithEvents(
    itemId: string,
    changes: { status: QueueItemRecord['status']; startedAt?: Date; endedAt?: Date },
    events: DomainEvent<unknown>[],
  ): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.queueItem.update({ where: { id: itemId }, data: changes }),
      ...this.outboxCreates(events),
    ]);
  }

  async findById(itemId: string): Promise<QueueItemRecord | null> {
    return this.prisma.queueItem.findUnique({ where: { id: itemId } });
  }

  async findPlaying(roomId: string): Promise<QueueItemRecord | null> {
    return this.prisma.queueItem.findFirst({ where: { roomId, status: 'PLAYING' } });
  }

  async findNextPending(roomId: string): Promise<QueueItemRecord | null> {
    return this.prisma.queueItem.findFirst({
      where: { roomId, status: 'PENDING' },
      orderBy: { position: 'asc' },
    });
  }

  async listPending(roomId: string): Promise<QueueItemRecord[]> {
    return this.prisma.queueItem.findMany({
      where: { roomId, status: 'PENDING' },
      orderBy: { position: 'asc' },
    });
  }

  async hasPendingVideo(roomId: string, videoId: string): Promise<boolean> {
    const found = await this.prisma.queueItem.findFirst({
      where: { roomId, videoId, status: { in: ['PENDING', 'PLAYING'] } },
      select: { id: true },
    });
    return found !== null;
  }

  async maxPosition(roomId: string): Promise<number> {
    const result = await this.prisma.queueItem.aggregate({
      where: { roomId },
      _max: { position: true },
    });
    return result._max.position ?? 0;
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
