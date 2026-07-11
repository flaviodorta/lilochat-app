import { z } from 'zod';
import { playbackStateSchema, queueItemSchema } from '../dto/rooms.js';

/** Socket.io contract for the `/room` namespace (CLAUDE.md §7.2) — Phase 2 subset. */
export const ROOM_NAMESPACE = '/room';
/** Public namespace: live card patches for the home directory (§7.2). */
export const LOBBY_NAMESPACE = '/lobby';
export const LOBBY_EVENTS = { roomSummary: 'room:summary' } as const;

export const SOCKET_EVENTS = {
  // client → server
  roomJoin: 'room:join',
  syncPing: 'sync:ping',
  // server → client
  playbackStarted: 'playback:started',
  queueUpdated: 'queue:updated',
  syncPong: 'sync:pong',
} as const;

export const roomJoinPayloadSchema = z.object({
  roomId: z.string().uuid(),
});
export type RoomJoinPayload = z.infer<typeof roomJoinPayloadSchema>;

/** NTP-style clock sync (§6.2): offset ≈ serverNow − (clientSentAt + rtt/2). */
export const syncPingSchema = z.object({
  clientSentAt: z.number(), // client epoch ms
});
export type SyncPing = z.infer<typeof syncPingSchema>;

export const syncPongSchema = z.object({
  clientSentAt: z.number(), // echoed back for RTT measurement
  serverNow: z.number(), // server epoch ms
});
export type SyncPong = z.infer<typeof syncPongSchema>;

export const playbackStartedPayloadSchema = playbackStateSchema.extend({
  roomId: z.string().uuid(),
});
export type PlaybackStartedPayload = z.infer<typeof playbackStartedPayloadSchema>;

export const queueUpdatedPayloadSchema = z.object({
  roomId: z.string().uuid(),
  queue: z.array(queueItemSchema),
});
export type QueueUpdatedPayload = z.infer<typeof queueUpdatedPayloadSchema>;
