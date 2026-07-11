import { Inject, Injectable } from '@nestjs/common';
import type { PlaybackState, QueueItem } from '@lilochat/contracts';
import { GATEWAY_CONFIG, type GatewayConfig } from '../config.js';
import { internalRequest } from './internal-http.js';

export interface RoomPlaybackState {
  playback: PlaybackState | null;
  queue: QueueItem[];
  serverNow: string;
}

@Injectable()
export class PlaybackClient {
  private readonly baseUrl: string;

  constructor(@Inject(GATEWAY_CONFIG) config: GatewayConfig) {
    this.baseUrl = config.PLAYBACK_SERVICE_URL;
  }

  addVideo(
    roomId: string,
    body: { videoUrl: string; addedById: string; addedByNickname: string },
  ): Promise<QueueItem> {
    return internalRequest(this.baseUrl, 'POST', `/internal/rooms/${roomId}/queue`, body);
  }

  getState(roomId: string): Promise<RoomPlaybackState> {
    return internalRequest(this.baseUrl, 'GET', `/internal/rooms/${roomId}/state`);
  }

  removeItem(
    roomId: string,
    itemId: string,
    query: { requesterId: string; isRoomOwner: boolean },
  ): Promise<void> {
    return internalRequest(
      this.baseUrl,
      'DELETE',
      `/internal/rooms/${roomId}/queue/${itemId}` +
        `?requesterId=${query.requesterId}&isRoomOwner=${query.isRoomOwner}`,
    );
  }
}
