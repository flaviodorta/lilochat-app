import type { OutboxClient, OutboxRow } from '@lilochat/nest-shared';
import type { PrismaService } from './prisma.service.js';

/** The ~5-line per-service adapter the OutboxRelay is generic over. */
export class PrismaOutboxClient implements OutboxClient {
  constructor(private readonly prisma: PrismaService) {}

  fetchUnpublished(batchSize: number): Promise<OutboxRow[]> {
    return this.prisma.outboxEvent.findMany({
      where: { publishedAt: null },
      orderBy: { id: 'asc' }, // uuid v7 = chronological
      take: batchSize,
    });
  }

  async markPublished(ids: string[], at: Date): Promise<void> {
    await this.prisma.outboxEvent.updateMany({
      where: { id: { in: ids } },
      data: { publishedAt: at },
    });
  }
}
