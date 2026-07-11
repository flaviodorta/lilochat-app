import type { ListRoomsResponse } from '@lilochat/contracts';
import type { Clock, RoomCardRepository } from '../domain/ports.js';

export interface ListRoomsInput {
  limit: number;
  cursor?: string;
  q?: string;
}

export class ListRoomsUseCase {
  constructor(private readonly deps: { cards: RoomCardRepository; clock: Clock }) {}

  async execute(input: ListRoomsInput): Promise<ListRoomsResponse> {
    const page = await this.deps.cards.list(input);
    return {
      items: page.items,
      nextCursor: page.nextCursor,
      serverNow: this.deps.clock.now().toISOString(),
    };
  }
}
