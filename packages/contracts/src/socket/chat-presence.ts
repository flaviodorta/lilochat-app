import { z } from 'zod';
import { chatContentSchema } from '../events/chat.js';

/** Phase-3 additions to the `/room` namespace (CLAUDE.md §7.2). */
export const CHAT_SOCKET_EVENTS = {
  // client → server
  chatSend: 'chat:send',
  // server → client
  chatNew: 'chat:new',
  chatAck: 'chat:ack',
  chatRetract: 'chat:retract',
  presenceState: 'presence:state',
  presenceJoined: 'presence:joined',
  presenceLeft: 'presence:left',
} as const;

export const chatSendPayloadSchema = z.object({
  tempId: z.string().min(1).max(64),
  content: chatContentSchema,
});
export type ChatSendPayload = z.infer<typeof chatSendPayloadSchema>;

/** Optimistic broadcast: shown immediately as pending; ack flips it to durable. */
export const chatNewPayloadSchema = z.object({
  tempId: z.string(),
  roomId: z.string().uuid(),
  userId: z.string().uuid(),
  nickname: z.string(),
  content: chatContentSchema,
  sentAt: z.string().datetime(),
});
export type ChatNewPayload = z.infer<typeof chatNewPayloadSchema>;

export const chatAckPayloadSchema = z.object({
  tempId: z.string(),
  messageId: z.string().uuid(),
  createdAt: z.string().datetime(),
});
export type ChatAckPayload = z.infer<typeof chatAckPayloadSchema>;

export const chatRetractPayloadSchema = z.object({
  tempId: z.string(),
});
export type ChatRetractPayload = z.infer<typeof chatRetractPayloadSchema>;

export const presenceUserSchema = z.object({
  userId: z.string().uuid(),
  nickname: z.string(),
});
export type PresenceUser = z.infer<typeof presenceUserSchema>;

export const presenceStatePayloadSchema = z.object({
  roomId: z.string().uuid(),
  users: z.array(presenceUserSchema),
});
export type PresenceStatePayload = z.infer<typeof presenceStatePayloadSchema>;
