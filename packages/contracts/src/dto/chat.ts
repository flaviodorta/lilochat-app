import { z } from 'zod';
import { chatContentSchema } from '../events/chat.js';

export const chatMessageSchema = z.object({
  id: z.string().uuid(),
  roomId: z.string().uuid(),
  userId: z.string().uuid(),
  nickname: z.string(),
  content: chatContentSchema,
  createdAt: z.string().datetime(),
});
export type ChatMessage = z.infer<typeof chatMessageSchema>;

export const listMessagesQuerySchema = z.object({
  cursor: z.string().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(50),
});
export type ListMessagesQuery = z.infer<typeof listMessagesQuerySchema>;

/** Newest page first; `nextCursor` walks backwards in time (infinite scroll upward). */
export const listMessagesResponseSchema = z.object({
  items: z.array(chatMessageSchema),
  nextCursor: z.string().nullable(),
});
export type ListMessagesResponse = z.infer<typeof listMessagesResponseSchema>;
