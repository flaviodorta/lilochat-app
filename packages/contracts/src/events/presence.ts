import { z } from 'zod';
import { domainEventSchema } from './envelope.js';

/** One socket connection = one session (a user with two tabs has two sessions). */
export const presenceUserJoinedEvent = domainEventSchema(
  'presence.user.joined',
  z.object({
    roomId: z.string().uuid(),
    userId: z.string().uuid(),
    sessionId: z.string().uuid(),
    at: z.string().datetime(),
  }),
);
export type PresenceUserJoinedEvent = z.infer<typeof presenceUserJoinedEvent>;

export const presenceUserLeftEvent = domainEventSchema(
  'presence.user.left',
  z.object({
    roomId: z.string().uuid(),
    userId: z.string().uuid(),
    sessionId: z.string().uuid(),
    at: z.string().datetime(),
    durationS: z.number().int().nonnegative(),
  }),
);
export type PresenceUserLeftEvent = z.infer<typeof presenceUserLeftEvent>;
