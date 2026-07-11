import { Controller, Get, Inject, Query, UseGuards } from '@nestjs/common';
import {
  leaderboardQuerySchema,
  type LeaderboardQuery,
  type LeaderboardResponse,
  type UserStats,
} from '@lilochat/contracts';
import { ZodValidationPipe } from '@lilochat/nest-shared';
import { EngagementClient } from '../clients/engagement.client.js';
import { CurrentUser } from '../security/current-user.decorator.js';
import { JwtAuthGuard, type AuthenticatedUser } from '../security/jwt-auth.guard.js';

@Controller()
export class LeaderboardController {
  constructor(@Inject(EngagementClient) private readonly engagement: EngagementClient) {}

  /** Public: the leaderboard is a storefront feature. */
  @Get('leaderboard')
  leaderboard(
    @Query(new ZodValidationPipe(leaderboardQuerySchema)) query: LeaderboardQuery,
  ): Promise<LeaderboardResponse> {
    return this.engagement.leaderboard(query);
  }

  @Get('users/me/stats')
  @UseGuards(JwtAuthGuard)
  myStats(@CurrentUser() user: AuthenticatedUser): Promise<UserStats> {
    return this.engagement.stats(user.id);
  }
}
