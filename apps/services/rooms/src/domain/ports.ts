import type { DomainEvent, RoomCard } from '@lilochat/contracts';
import type { Room } from './room.js';

export interface RoomRepository {
  /** Room + its card + the outbox event in ONE transaction (write-time composition). */
  createWithEvent(room: Room, event: DomainEvent<unknown>): Promise<void>;
  findById(id: string): Promise<Room | null>;
}

export interface CardPage {
  items: RoomCard[];
  nextCursor: string | null;
}

export interface RoomCardRepository {
  list(options: { limit: number; cursor?: string; q?: string }): Promise<CardPage>;
  findByRoomId(roomId: string): Promise<RoomCard | null>;
  adjustViewers(roomId: string, delta: number): Promise<void>;
  applyVideoStarted(input: {
    roomId: string;
    videoId: string;
    title: string;
    thumbUrl: string;
    durationS: number;
    startedAt: Date;
  }): Promise<void>;
}

export interface Clock {
  now(): Date;
}

export interface IdGenerator {
  next(): string;
}
