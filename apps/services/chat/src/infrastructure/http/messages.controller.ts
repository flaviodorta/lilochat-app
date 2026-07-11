import { Controller, Get, Inject, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import {
  listMessagesQuerySchema,
  type ListMessagesQuery,
  type ListMessagesResponse,
} from '@lilochat/contracts';
import { ZodValidationPipe } from '@lilochat/nest-shared';
import { PrismaMessageRepository } from '../prisma/prisma-message.repository.js';

@Controller('internal/rooms/:roomId/messages')
export class MessagesController {
  constructor(
    @Inject(PrismaMessageRepository) private readonly messages: PrismaMessageRepository,
  ) {}

  @Get()
  list(
    @Param('roomId', ParseUUIDPipe) roomId: string,
    @Query(new ZodValidationPipe(listMessagesQuerySchema)) query: ListMessagesQuery,
  ): Promise<ListMessagesResponse> {
    return this.messages.list(roomId, query);
  }
}
