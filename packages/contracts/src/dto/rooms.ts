import { z } from 'zod';

export const roomNameSchema = z
  .string()
  .trim()
  .min(3, 'Room name must be at least 3 characters')
  .max(50, 'Room name must be at most 50 characters');

const YOUTUBE_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'music.youtube.com',
  'youtu.be',
  'www.youtu.be',
]);

/** Edge validation only — videoId extraction/verification lives in playback-service. */
export const youtubeUrlSchema = z
  .string()
  .url()
  .max(2048)
  .refine((value) => {
    try {
      const url = new URL(value);
      return (
        (url.protocol === 'https:' || url.protocol === 'http:') &&
        YOUTUBE_HOSTS.has(url.hostname.toLowerCase())
      );
    } catch {
      return false;
    }
  }, 'Must be a YouTube video URL');

/**
 * The server-authoritative playback tuple (CLAUDE.md §6.2).
 * position(t) = clamp(t_server − startedAt, 0, durationS) — nobody can pause.
 */
export const playbackStateSchema = z.object({
  itemId: z.string().uuid(),
  videoId: z.string().min(5).max(20),
  title: z.string(),
  durationS: z.number().int().positive(),
  thumbUrl: z.string().url(),
  startedAt: z.string().datetime(),
});
export type PlaybackState = z.infer<typeof playbackStateSchema>;

export const queueItemSchema = z.object({
  itemId: z.string().uuid(),
  videoId: z.string().min(5).max(20),
  title: z.string(),
  durationS: z.number().int().positive(),
  thumbUrl: z.string().url(),
  addedById: z.string().uuid(),
  addedByNickname: z.string(),
  status: z.enum(['pending', 'playing']),
});
export type QueueItem = z.infer<typeof queueItemSchema>;

/** Home-page card — served by the rooms read model (CQRS, ADR-006). */
export const roomCardSchema = z.object({
  id: z.string().uuid(),
  name: roomNameSchema,
  viewers: z.number().int().nonnegative(),
  video: playbackStateSchema.omit({ itemId: true }).nullable(),
});
export type RoomCard = z.infer<typeof roomCardSchema>;

export const listRoomsQuerySchema = z.object({
  cursor: z.string().max(200).optional(),
  q: z.string().trim().max(50).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
export type ListRoomsQuery = z.infer<typeof listRoomsQuerySchema>;

export const listRoomsResponseSchema = z.object({
  items: z.array(roomCardSchema),
  nextCursor: z.string().nullable(),
  /** Lets the home page estimate clock offset before any WS connection. */
  serverNow: z.string().datetime(),
});
export type ListRoomsResponse = z.infer<typeof listRoomsResponseSchema>;

export const createRoomBodySchema = z.object({
  name: roomNameSchema,
  firstVideoUrl: youtubeUrlSchema,
});
export type CreateRoomBody = z.infer<typeof createRoomBodySchema>;

export const createRoomResponseSchema = z.object({
  id: z.string().uuid(),
  name: roomNameSchema,
});
export type CreateRoomResponse = z.infer<typeof createRoomResponseSchema>;

export const roomDetailSchema = z.object({
  id: z.string().uuid(),
  name: roomNameSchema,
  ownerId: z.string().uuid(),
  viewers: z.number().int().nonnegative(),
  playback: playbackStateSchema.nullable(),
  queue: z.array(queueItemSchema),
  serverNow: z.string().datetime(),
});
export type RoomDetail = z.infer<typeof roomDetailSchema>;

export const addToQueueBodySchema = z.object({
  videoUrl: youtubeUrlSchema,
});
export type AddToQueueBody = z.infer<typeof addToQueueBodySchema>;
