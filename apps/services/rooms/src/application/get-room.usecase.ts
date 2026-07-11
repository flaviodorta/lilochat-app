import type { RoomCard } from '@lilochat/contracts';
import { RoomNotFoundError } from '../domain/errors.js';
import type { RoomCardRepository, RoomRepository } from '../domain/ports.js';

/** Room meta + card — the gateway composes this with playback state (2.7). */
export interface RoomMeta {
  id: string;
  name: string;
  ownerId: string;
  status: string;
  card: RoomCard;
}

export class GetRoomUseCase {
  constructor(private readonly deps: { rooms: RoomRepository; cards: RoomCardRepository }) {}

  async execute(roomId: string): Promise<RoomMeta> {
    const [room, card] = await Promise.all([
      this.deps.rooms.findById(roomId),
      this.deps.cards.findByRoomId(roomId),
    ]);
    if (!room || !card) throw new RoomNotFoundError();
    return { id: room.id, name: room.name, ownerId: room.ownerId, status: room.status, card };
  }
}
