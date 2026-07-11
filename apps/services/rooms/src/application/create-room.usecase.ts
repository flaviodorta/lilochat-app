import { makeDomainEvent } from '@lilochat/nest-shared';
import type { CreateRoomResponse } from '@lilochat/contracts';
import type { Clock, IdGenerator, RoomRepository } from '../domain/ports.js';
import { Room } from '../domain/room.js';

export interface CreateRoomInput {
  name: string;
  ownerId: string;
}

export class CreateRoomUseCase {
  constructor(private readonly deps: { rooms: RoomRepository; clock: Clock; ids: IdGenerator }) {}

  async execute(input: CreateRoomInput): Promise<CreateRoomResponse> {
    const { rooms, clock, ids } = this.deps;
    const room = Room.create({
      id: ids.next(),
      name: input.name,
      ownerId: input.ownerId,
      now: clock.now(),
    });

    const event = makeDomainEvent(
      'room.created',
      { roomId: room.id, name: room.name, ownerId: room.ownerId },
      clock.now(),
    );
    await rooms.createWithEvent(room, event); // room + card + outbox, one transaction

    return { id: room.id, name: room.name };
  }
}
