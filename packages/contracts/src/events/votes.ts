import { z } from 'zod';
import { domainEventSchema } from './envelope.js';

export const voteStartedEvent = domainEventSchema(
  'playback.vote.started',
  z.object({
    roomId: z.string().uuid(),
    voteId: z.string().uuid(),
    itemId: z.string().uuid(),
    startedBy: z.string().uuid(),
    endsAt: z.string().datetime(),
    /** Quorum snapshot at start — display only; re-derived at resolution (§6.4). */
    needed: z.number().int().positive(),
    yes: z.number().int().nonnegative(),
  }),
);
export type VoteStartedEvent = z.infer<typeof voteStartedEvent>;

export const voteProgressEvent = domainEventSchema(
  'playback.vote.progress',
  z.object({
    roomId: z.string().uuid(),
    voteId: z.string().uuid(),
    yes: z.number().int().nonnegative(),
    needed: z.number().int().positive(),
  }),
);
export type VoteProgressEvent = z.infer<typeof voteProgressEvent>;

export const voteFinishedEvent = domainEventSchema(
  'playback.vote.finished',
  z.object({
    roomId: z.string().uuid(),
    voteId: z.string().uuid(),
    passed: z.boolean(),
    yes: z.number().int().nonnegative(),
    needed: z.number().int().positive(),
  }),
);
export type VoteFinishedEvent = z.infer<typeof voteFinishedEvent>;

/** `/room` namespace additions (§7.2). */
export const VOTE_SOCKET_EVENTS = {
  // client → server
  voteStart: 'vote:start',
  voteCast: 'vote:cast',
  // server → client
  voteStarted: 'vote:started',
  voteProgress: 'vote:progress',
  voteFinished: 'vote:finished',
} as const;

export const voteCastPayloadSchema = z.object({
  voteId: z.string().uuid(),
});
export type VoteCastPayload = z.infer<typeof voteCastPayloadSchema>;
