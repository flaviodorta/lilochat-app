import { z } from 'zod';
import { domainEventSchema } from './envelope.js';

export const userRegisteredEvent = domainEventSchema(
  'identity.user.registered',
  z.object({
    userId: z.string().uuid(),
    nickname: z.string(),
  }),
);
export type UserRegisteredEvent = z.infer<typeof userRegisteredEvent>;

export const userUpdatedEvent = domainEventSchema(
  'identity.user.updated',
  z.object({
    userId: z.string().uuid(),
    nickname: z.string(),
  }),
);
export type UserUpdatedEvent = z.infer<typeof userUpdatedEvent>;
