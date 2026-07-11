import { Inject, Injectable } from '@nestjs/common';
import type { ListMessagesQuery, ListMessagesResponse } from '@lilochat/contracts';
import { GATEWAY_CONFIG, type GatewayConfig } from '../config.js';
import { internalRequest } from './internal-http.js';

@Injectable()
export class ChatClient {
  private readonly baseUrl: string;

  constructor(@Inject(GATEWAY_CONFIG) config: GatewayConfig) {
    this.baseUrl = config.CHAT_SERVICE_URL;
  }

  listMessages(roomId: string, query: ListMessagesQuery): Promise<ListMessagesResponse> {
    const params = new URLSearchParams();
    if (query.cursor) params.set('cursor', query.cursor);
    params.set('limit', String(query.limit));
    return internalRequest(this.baseUrl, 'GET', `/internal/rooms/${roomId}/messages?${params}`);
  }
}
