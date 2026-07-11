import type { DomainEvent } from '@lilochat/contracts';
import { outboxRowFrom } from '@lilochat/nest-shared';
import type { Prisma } from '../../../generated/client/index.js';
import type { RoomRepository } from '../../domain/ports.js';
import { Room } from '../../domain/room.js';
import type { PrismaService } from './prisma.service.js';

export class PrismaRoomRepository implements RoomRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Room + its card + the outbox event: atomic — the card read model is born
   *  with the room (write-time composition) and the event cannot be lost. */
  async createWithEvent(room: Room, event: DomainEvent<unknown>): Promise<void> {
    const outbox = outboxRowFrom(event);
    await this.prisma.$transaction([
      this.prisma.room.create({
        data: {
          id: room.id,
          name: room.name,
          ownerId: room.ownerId,
          status: room.status,
          createdAt: room.createdAt,
          updatedAt: room.updatedAt,
        },
      }),
      this.prisma.roomCard.create({
        data: {
          roomId: room.id,
          name: room.name,
          viewers: 0,
          createdAt: room.createdAt,
          updatedAt: room.updatedAt,
        },
      }),
      this.prisma.outboxEvent.create({
        data: { ...outbox, payload: outbox.payload as Prisma.InputJsonValue },
      }),
    ]);
  }

  async findById(id: string): Promise<Room | null> {
    const row = await this.prisma.room.findUnique({ where: { id } });
    return row ? Room.reconstitute({ ...row }) : null;
  }
}
