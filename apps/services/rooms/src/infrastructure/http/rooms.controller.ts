import { Body, Controller, Get, Inject, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { z } from 'zod';
import {
  createRoomBodySchema,
  listRoomsQuerySchema,
  roomNameSchema,
  type ListRoomsQuery,
  type ListRoomsResponse,
} from '@lilochat/contracts';
import { ZodValidationPipe } from '@lilochat/nest-shared';
import { CreateRoomUseCase } from '../../application/create-room.usecase.js';
import { GetRoomUseCase, type RoomMeta } from '../../application/get-room.usecase.js';
import { ListRoomsUseCase } from '../../application/list-rooms.usecase.js';

/**
 * Internal API. The gateway injects ownerId from the verified JWT (clients
 * never send it) and composes GET /rooms/:id with playback state (2.7).
 * `firstVideoUrl` from the public contract is handled BY THE GATEWAY: it
 * creates the room here, then enqueues the video on playback-service.
 */
const internalCreateRoomSchema = createRoomBodySchema
  .omit({ firstVideoUrl: true })
  .extend({ name: roomNameSchema, ownerId: z.string().uuid() });
type InternalCreateRoom = z.infer<typeof internalCreateRoomSchema>;

@Controller('rooms')
export class RoomsController {
  constructor(
    @Inject(CreateRoomUseCase) private readonly createRoom: CreateRoomUseCase,
    @Inject(ListRoomsUseCase) private readonly listRooms: ListRoomsUseCase,
    @Inject(GetRoomUseCase) private readonly getRoom: GetRoomUseCase,
  ) {}

  @Post()
  create(@Body(new ZodValidationPipe(internalCreateRoomSchema)) body: InternalCreateRoom) {
    return this.createRoom.execute(body);
  }

  @Get()
  list(
    @Query(new ZodValidationPipe(listRoomsQuerySchema)) query: ListRoomsQuery,
  ): Promise<ListRoomsResponse> {
    return this.listRooms.execute(query);
  }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string): Promise<RoomMeta> {
    return this.getRoom.execute(id);
  }
}
