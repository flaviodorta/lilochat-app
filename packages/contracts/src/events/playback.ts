import { z } from 'zod';
import { domainEventSchema } from './envelope.js';
import { queueItemSchema } from '../dto/rooms.js';

const videoFields = {
  roomId: z.string().uuid(),
  itemId: z.string().uuid(),
  videoId: z.string().min(5).max(20),
  title: z.string(),
  durationS: z.number().int().positive(),
  thumbUrl: z.string().url(),
};

export const videoAddedEvent = domainEventSchema(
  'playback.video.added',
  z.object({ ...videoFields, addedBy: z.string().uuid() }),
);
export type VideoAddedEvent = z.infer<typeof videoAddedEvent>;

/** THE event: consumers (rooms read model, realtime gateway) sync rooms off `startedAt`. */
export const videoStartedEvent = domainEventSchema(
  'playback.video.started',
  z.object({ ...videoFields, startedAt: z.string().datetime() }),
);
export type VideoStartedEvent = z.infer<typeof videoStartedEvent>;

export const videoSkippedEvent = domainEventSchema(
  'playback.video.skipped',
  z.object({
    roomId: z.string().uuid(),
    itemId: z.string().uuid(),
    reason: z.enum(['vote', 'ended', 'removed', 'empty']),
  }),
);
export type VideoSkippedEvent = z.infer<typeof videoSkippedEvent>;

export const queueUpdatedEvent = domainEventSchema(
  'playback.queue.updated',
  z.object({
    roomId: z.string().uuid(),
    queue: z.array(queueItemSchema),
  }),
);
export type QueueUpdatedEvent = z.infer<typeof queueUpdatedEvent>;
