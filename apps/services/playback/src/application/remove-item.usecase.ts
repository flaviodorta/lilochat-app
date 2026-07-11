import { makeDomainEvent } from '@lilochat/nest-shared';
import {
  CannotRemovePlayingItemError,
  NotAllowedToRemoveError,
  QueueItemNotFoundError,
} from '../domain/errors.js';
import type { Clock, QueueRepository } from '../domain/ports.js';
import { toQueueItemDto } from './playback-manager.js';

export interface RemoveItemInput {
  roomId: string;
  itemId: string;
  requesterId: string;
  /** Resolved by the gateway from rooms-service (room.ownerId === requester). */
  isRoomOwner: boolean;
}

export class RemoveItemUseCase {
  constructor(private readonly deps: { queue: QueueRepository; clock: Clock }) {}

  async execute(input: RemoveItemInput): Promise<void> {
    const { queue, clock } = this.deps;
    const item = await queue.findById(input.itemId);
    if (
      !item ||
      item.roomId !== input.roomId ||
      item.status === 'DONE' ||
      item.status === 'SKIPPED'
    ) {
      throw new QueueItemNotFoundError();
    }
    if (item.status === 'PLAYING') throw new CannotRemovePlayingItemError();
    if (item.addedById !== input.requesterId && !input.isRoomOwner) {
      throw new NotAllowedToRemoveError();
    }

    const now = clock.now();
    const remaining = (await queue.listPending(input.roomId)).filter((i) => i.id !== item.id);
    await queue.transitionWithEvents(item.id, { status: 'SKIPPED', endedAt: now }, [
      makeDomainEvent(
        'playback.video.skipped',
        { roomId: input.roomId, itemId: item.id, reason: 'removed' },
        now,
      ),
      makeDomainEvent(
        'playback.queue.updated',
        { roomId: input.roomId, queue: remaining.map(toQueueItemDto) },
        now,
      ),
    ]);
  }
}
