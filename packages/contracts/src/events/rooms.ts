import { z } from 'zod';
import { domainEventSchema } from './envelope.js';

export const roomCreatedEvent = domainEventSchema(
  'room.created',
  z.object({
    roomId: z.string().uuid(),
    name: z.string(),
    ownerId: z.string().uuid(),
  }),
);
export type RoomCreatedEvent = z.infer<typeof roomCreatedEvent>;

export const roomArchivedEvent = domainEventSchema(
  'room.archived',
  z.object({
    roomId: z.string().uuid(),
  }),
);
export type RoomArchivedEvent = z.infer<typeof roomArchivedEvent>;
