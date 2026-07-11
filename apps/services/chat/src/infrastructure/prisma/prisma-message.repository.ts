import type { DomainEvent, ChatMessage } from '@lilochat/contracts';
import { outboxRowFrom } from '@lilochat/nest-shared';
import { Prisma } from '../../../generated/client/index.js';
import type {
  MessageRecord,
  MessageRepository,
} from '../../application/persist-message.usecase.js';
import type { PrismaService } from './prisma.service.js';

export interface MessagePage {
  items: ChatMessage[];
  nextCursor: string | null;
}

export class PrismaMessageRepository implements MessageRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createWithEvent(message: MessageRecord, event: unknown): Promise<void> {
    const outbox = outboxRowFrom(event as DomainEvent<unknown>);
    try {
      await this.prisma.$transaction([
        this.prisma.message.create({ data: message }),
        this.prisma.outboxEvent.create({
          data: { ...outbox, payload: outbox.payload as Prisma.InputJsonValue },
        }),
      ]);
    } catch (error) {
      // redelivered event → message already persisted (and its ack already
      // outboxed in the same original transaction): idempotent no-op
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') return;
      throw error;
    }
  }

  /** Keyset (createdAt DESC, id DESC): newest page first, cursor walks older. */
  async list(roomId: string, options: { limit: number; cursor?: string }): Promise<MessagePage> {
    const cursor = options.cursor ? decodeCursor(options.cursor) : null;

    const rows = await this.prisma.message.findMany({
      where: {
        roomId,
        ...(cursor
          ? {
              OR: [
                { createdAt: { lt: cursor.createdAt } },
                { createdAt: cursor.createdAt, id: { lt: cursor.id } },
              ],
            }
          : {}),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: options.limit + 1,
    });

    const hasMore = rows.length > options.limit;
    const items = rows.slice(0, options.limit);
    const last = items.at(-1);

    return {
      items: items.map((row) => ({ ...row, createdAt: row.createdAt.toISOString() })),
      nextCursor: hasMore && last ? encodeCursor({ createdAt: last.createdAt, id: last.id }) : null,
    };
  }
}

function encodeCursor(cursor: { createdAt: Date; id: string }): string {
  return Buffer.from(`${cursor.createdAt.toISOString()}|${cursor.id}`).toString('base64url');
}

function decodeCursor(raw: string): { createdAt: Date; id: string } | null {
  try {
    const [iso, id] = Buffer.from(raw, 'base64url').toString('utf8').split('|');
    if (!iso || !id) return null;
    const createdAt = new Date(iso);
    return Number.isNaN(createdAt.getTime()) ? null : { createdAt, id };
  } catch {
    return null;
  }
}
