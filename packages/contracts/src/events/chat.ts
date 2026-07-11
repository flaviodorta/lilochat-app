import { z } from 'zod';
import { domainEventSchema } from './envelope.js';

export const chatContentSchema = z.string().trim().min(1).max(500);

/**
 * RTG → chat-service. Carries `nickname` (denormalization at the source, §8)
 * and `tempId` so the persisted ack can reconcile the optimistic broadcast.
 */
export const chatMessageSubmittedEvent = domainEventSchema(
  'chat.message.submitted',
  z.object({
    roomId: z.string().uuid(),
    tempId: z.string().min(1).max(64),
    userId: z.string().uuid(),
    nickname: z.string(),
    content: chatContentSchema,
    sentAt: z.string().datetime(),
  }),
);
export type ChatMessageSubmittedEvent = z.infer<typeof chatMessageSubmittedEvent>;

export const chatMessagePersistedEvent = domainEventSchema(
  'chat.message.persisted',
  z.object({
    messageId: z.string().uuid(),
    tempId: z.string().min(1).max(64),
    roomId: z.string().uuid(),
    userId: z.string().uuid(),
    nickname: z.string(),
    content: chatContentSchema,
    createdAt: z.string().datetime(),
  }),
);
export type ChatMessagePersistedEvent = z.infer<typeof chatMessagePersistedEvent>;
