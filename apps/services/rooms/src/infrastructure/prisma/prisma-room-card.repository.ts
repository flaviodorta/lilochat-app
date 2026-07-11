import type { RoomCard } from '@lilochat/contracts';
import type { RoomCard as RoomCardRow } from '../../../generated/client/index.js';
import { decodeCursor, encodeCursor } from '../../application/cursor.js';
import type { CardPage, RoomCardRepository } from '../../domain/ports.js';
import type { PrismaService } from './prisma.service.js';

export class PrismaRoomCardRepository implements RoomCardRepository {
  constructor(private readonly prisma: PrismaService) {}

  async list(options: { limit: number; cursor?: string; q?: string }): Promise<CardPage> {
    const cursor = options.cursor ? decodeCursor(options.cursor) : null;

    const rows = await this.prisma.roomCard.findMany({
      where: {
        // `contains` = ILIKE %q% — accelerated by the trigram GIN index
        ...(options.q ? { name: { contains: options.q, mode: 'insensitive' } } : {}),
        ...(cursor
          ? {
              OR: [
                { createdAt: { lt: cursor.createdAt } },
                { createdAt: cursor.createdAt, roomId: { lt: cursor.roomId } },
              ],
            }
          : {}),
      },
      orderBy: [{ createdAt: 'desc' }, { roomId: 'desc' }],
      take: options.limit + 1, // one extra to know whether a next page exists
    });

    const hasMore = rows.length > options.limit;
    const items = rows.slice(0, options.limit);
    const last = items.at(-1);

    return {
      items: items.map((row) => this.toCard(row)),
      nextCursor:
        hasMore && last ? encodeCursor({ createdAt: last.createdAt, roomId: last.roomId }) : null,
    };
  }

  async findByRoomId(roomId: string): Promise<RoomCard | null> {
    const row = await this.prisma.roomCard.findUnique({ where: { roomId } });
    return row ? this.toCard(row) : null;
  }

  async applyVideoStarted(input: {
    roomId: string;
    videoId: string;
    title: string;
    thumbUrl: string;
    durationS: number;
    startedAt: Date;
  }): Promise<void> {
    await this.prisma.roomCard.updateMany({
      // updateMany: unknown roomId (out-of-order event) must not throw — it's a no-op
      where: { roomId: input.roomId },
      data: {
        videoId: input.videoId,
        videoTitle: input.title,
        videoThumbUrl: input.thumbUrl,
        videoDurationS: input.durationS,
        videoStartedAt: input.startedAt,
      },
    });
  }

  private toCard(row: RoomCardRow): RoomCard {
    const hasVideo =
      row.videoId !== null &&
      row.videoTitle !== null &&
      row.videoThumbUrl !== null &&
      row.videoDurationS !== null &&
      row.videoStartedAt !== null;

    return {
      id: row.roomId,
      name: row.name,
      viewers: row.viewers,
      video: hasVideo
        ? {
            videoId: row.videoId as string,
            title: row.videoTitle as string,
            thumbUrl: row.videoThumbUrl as string,
            durationS: row.videoDurationS as number,
            startedAt: (row.videoStartedAt as Date).toISOString(),
          }
        : null,
    };
  }
}
