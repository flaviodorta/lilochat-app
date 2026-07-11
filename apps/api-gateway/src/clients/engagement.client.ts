import { Inject, Injectable } from '@nestjs/common';
import type { LeaderboardQuery, LeaderboardResponse, UserStats } from '@lilochat/contracts';
import { GATEWAY_CONFIG, type GatewayConfig } from '../config.js';
import { internalRequest } from './internal-http.js';

@Injectable()
export class EngagementClient {
  private readonly baseUrl: string;

  constructor(@Inject(GATEWAY_CONFIG) config: GatewayConfig) {
    this.baseUrl = config.ENGAGEMENT_SERVICE_URL;
  }

  leaderboard(query: LeaderboardQuery): Promise<LeaderboardResponse> {
    return internalRequest(
      this.baseUrl,
      'GET',
      `/internal/leaderboard?period=${query.period}&limit=${query.limit}`,
    );
  }

  stats(userId: string): Promise<UserStats> {
    return internalRequest(this.baseUrl, 'GET', `/internal/users/${userId}/stats`);
  }
}
