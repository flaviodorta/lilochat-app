import { Controller, Get, Inject, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import {
  leaderboardQuerySchema,
  type LeaderboardQuery,
  type LeaderboardResponse,
  type UserStats,
} from '@lilochat/contracts';
import { ZodValidationPipe } from '@lilochat/nest-shared';
import { currentKeyFor } from '../../application/periods.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { RedisLeaderboardStore } from '../redis/redis-leaderboard.store.js';

@Controller('internal')
export class LeaderboardController {
  constructor(
    @Inject(RedisLeaderboardStore) private readonly leaderboard: RedisLeaderboardStore,
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  private nicknameOf = async (userId: string): Promise<string> => {
    const profile = await this.prisma.userProfile.findUnique({ where: { userId } });
    return profile?.nickname ?? 'someone';
  };

  @Get('leaderboard')
  async top(
    @Query(new ZodValidationPipe(leaderboardQuerySchema)) query: LeaderboardQuery,
  ): Promise<LeaderboardResponse> {
    const key = currentKeyFor(query.period, new Date());
    return {
      period: query.period,
      rows: await this.leaderboard.top(key, query.limit, this.nicknameOf),
    };
  }

  @Get('users/:id/stats')
  async stats(@Param('id', ParseUUIDPipe) userId: string): Promise<UserStats> {
    const now = new Date();
    const [alltime, monthly, weekly] = await Promise.all([
      this.leaderboard.rankAndScore(currentKeyFor('alltime', now), userId),
      this.leaderboard.rankAndScore(currentKeyFor('monthly', now), userId),
      this.leaderboard.rankAndScore(currentKeyFor('weekly', now), userId),
    ]);
    return { userId, periods: { alltime, monthly, weekly } };
  }
}
