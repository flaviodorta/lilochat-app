import { z } from 'zod';

export const leaderboardPeriodSchema = z.enum(['alltime', 'monthly', 'weekly']);
export type LeaderboardPeriod = z.infer<typeof leaderboardPeriodSchema>;

export const leaderboardRowSchema = z.object({
  rank: z.number().int().positive(),
  userId: z.string().uuid(),
  nickname: z.string(),
  seconds: z.number().int().nonnegative(),
});
export type LeaderboardRow = z.infer<typeof leaderboardRowSchema>;

export const leaderboardQuerySchema = z.object({
  period: leaderboardPeriodSchema.default('alltime'),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
export type LeaderboardQuery = z.infer<typeof leaderboardQuerySchema>;

export const leaderboardResponseSchema = z.object({
  period: leaderboardPeriodSchema,
  rows: z.array(leaderboardRowSchema),
});
export type LeaderboardResponse = z.infer<typeof leaderboardResponseSchema>;

/** A user's own totals + rank per period (profile card / pinned row). */
export const userStatsSchema = z.object({
  userId: z.string().uuid(),
  periods: z.record(
    leaderboardPeriodSchema,
    z.object({ seconds: z.number().int().nonnegative(), rank: z.number().int().nullable() }),
  ),
});
export type UserStats = z.infer<typeof userStatsSchema>;
