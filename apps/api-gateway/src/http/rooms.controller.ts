import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  addToQueueBodySchema,
  createRoomBodySchema,
  listMessagesQuerySchema,
  listRoomsQuerySchema,
  type AddToQueueBody,
  type CreateRoomBody,
  type ListMessagesQuery,
  type ListMessagesResponse,
  type ListRoomsQuery,
  type ListRoomsResponse,
  type QueueItem,
  type RoomDetail,
} from '@lilochat/contracts';
import { LOGGER, ZodValidationPipe, type Logger } from '@lilochat/nest-shared';
import { ChatClient } from '../clients/chat.client.js';
import { PlaybackClient } from '../clients/playback.client.js';
import { RoomsClient } from '../clients/rooms.client.js';
import { CurrentUser } from '../security/current-user.decorator.js';
import { JwtAuthGuard, type AuthenticatedUser } from '../security/jwt-auth.guard.js';
import { RouteBucket } from '../security/route-bucket.decorator.js';

/**
 * Public rooms API — API composition at the edge (course A38/CLAUDE.md §7.1):
 * reads hit ONE service each (rooms = card read model, playback = hot state);
 * creation composes rooms + playback so the client makes a single call.
 */
@Controller('rooms')
export class RoomsController {
  constructor(
    @Inject(RoomsClient) private readonly rooms: RoomsClient,
    @Inject(PlaybackClient) private readonly playback: PlaybackClient,
    @Inject(ChatClient) private readonly chat: ChatClient,
    @Inject(LOGGER) private readonly logger: Logger,
  ) {}

  /** Public: guests browse the directory. */
  @Get()
  list(
    @Query(new ZodValidationPipe(listRoomsQuerySchema)) query: ListRoomsQuery,
  ): Promise<ListRoomsResponse> {
    return this.rooms.list(query);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createRoomBodySchema)) body: CreateRoomBody,
  ) {
    const room = await this.rooms.create({ name: body.name, ownerId: user.id });

    // composition step 2: enqueue the first video (it starts the idle room).
    // If this fails the room simply starts idle — the user can add from inside.
    try {
      await this.playback.addVideo(room.id, {
        videoUrl: body.firstVideoUrl,
        addedById: user.id,
        addedByNickname: user.nickname,
      });
    } catch (error) {
      this.logger.warn(
        { err: error, roomId: room.id },
        'first video enqueue failed — room starts idle',
      );
    }

    return room;
  }

  /** Public: room state is visible to guests (joining/chatting is gated, watching the page is not). */
  @Get(':id')
  async get(@Param('id', ParseUUIDPipe) id: string): Promise<RoomDetail> {
    const [meta, state] = await Promise.all([this.rooms.get(id), this.playback.getState(id)]);
    return {
      id: meta.id,
      name: meta.name,
      ownerId: meta.ownerId,
      viewers: meta.card.viewers,
      playback: state.playback,
      queue: state.queue,
      serverNow: state.serverNow,
    };
  }

  /** Public: history is readable by guests, like the room page itself. */
  @Get(':id/messages')
  listMessages(
    @Param('id', ParseUUIDPipe) id: string,
    @Query(new ZodValidationPipe(listMessagesQuerySchema)) query: ListMessagesQuery,
  ): Promise<ListMessagesResponse> {
    return this.chat.listMessages(id, query);
  }

  @Post(':id/queue')
  @UseGuards(JwtAuthGuard)
  // §9.1: 5 adds/min per user — the generic allowance can't be spent spamming
  // the queue (each add can cost a YouTube API unit on cache miss)
  @RouteBucket({ tag: 'queue-add', capacity: 5, refillPerSec: 5 / 60 })
  addToQueue(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(addToQueueBodySchema)) body: AddToQueueBody,
  ): Promise<QueueItem> {
    return this.playback.addVideo(id, {
      videoUrl: body.videoUrl,
      addedById: user.id,
      addedByNickname: user.nickname,
    });
  }

  @Delete(':id/queue/:itemId')
  @HttpCode(204)
  @UseGuards(JwtAuthGuard)
  async removeFromQueue(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
  ): Promise<void> {
    const meta = await this.rooms.get(id); // resolve ownership server-side
    await this.playback.removeItem(id, itemId, {
      requesterId: user.id,
      isRoomOwner: meta.ownerId === user.id,
    });
  }
}
