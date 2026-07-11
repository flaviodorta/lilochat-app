import { z } from 'zod';
import { domainEventSchema } from './envelope.js';

/**
 * Batched watch-time checkpoints (§6.5): the RTG credits every open session
 * every ~60 s, bounding watch-time loss on crash to ≤ 60 s (the §4.2 RPO).
 */
export const presenceCheckpointEvent = domainEventSchema(
  'presence.checkpoint',
  z.object({
    entries: z.array(
      z.object({
        sessionId: z.string().uuid(),
        roomId: z.string().uuid(),
        userId: z.string().uuid(),
        seconds: z.number().int().nonnegative(),
      }),
    ),
  }),
);
export type PresenceCheckpointEvent = z.infer<typeof presenceCheckpointEvent>;
