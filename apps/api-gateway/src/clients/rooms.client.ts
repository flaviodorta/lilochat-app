import { Inject, Injectable } from '@nestjs/common';
import type { CreateRoomResponse, ListRoomsResponse, RoomCard } from '@lilochat/contracts';
import { GATEWAY_CONFIG, type GatewayConfig } from '../config.js';
import { internalRequest } from './internal-http.js';

export interface RoomMeta {
  id: string;
  name: string;
  ownerId: string;
  status: string;
  card: RoomCard;
}

@Injectable()
export class RoomsClient {
  private readonly baseUrl: string;

  constructor(@Inject(GATEWAY_CONFIG) config: GatewayConfig) {
    this.baseUrl = config.ROOMS_SERVICE_URL;
  }

  list(query: { cursor?: string; q?: string; limit?: number }): Promise<ListRoomsResponse> {
    const params = new URLSearchParams();
    if (query.cursor) params.set('cursor', query.cursor);
    if (query.q) params.set('q', query.q);
    if (query.limit) params.set('limit', String(query.limit));
    const qs = params.toString();
    return internalRequest(this.baseUrl, 'GET', `/rooms${qs ? `?${qs}` : ''}`);
  }

  create(body: { name: string; ownerId: string }): Promise<CreateRoomResponse> {
    return internalRequest(this.baseUrl, 'POST', '/rooms', body);
  }

  get(roomId: string): Promise<RoomMeta> {
    return internalRequest(this.baseUrl, 'GET', `/rooms/${roomId}`);
  }
}
