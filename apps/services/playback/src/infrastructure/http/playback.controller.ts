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
} from '@nestjs/common';
import { z } from 'zod';
import { addToQueueBodySchema, nicknameSchema } from '@lilochat/contracts';
import { ZodValidationPipe } from '@lilochat/nest-shared';
import { AddVideoUseCase } from '../../application/add-video.usecase.js';
import { GetRoomStateUseCase } from '../../application/get-room-state.usecase.js';
import { RemoveItemUseCase } from '../../application/remove-item.usecase.js';

/** Internal API — the gateway injects the authenticated user's id/nickname. */
const internalAddVideoSchema = addToQueueBodySchema.extend({
  addedById: z.string().uuid(),
  addedByNickname: nicknameSchema,
});
type InternalAddVideo = z.infer<typeof internalAddVideoSchema>;

const removeQuerySchema = z.object({
  requesterId: z.string().uuid(),
  isRoomOwner: z
    .enum(['true', 'false'])
    .transform((value) => value === 'true')
    .default('false'),
});
type RemoveQuery = z.infer<typeof removeQuerySchema>;

@Controller('internal/rooms/:roomId')
export class PlaybackController {
  constructor(
    @Inject(AddVideoUseCase) private readonly addVideo: AddVideoUseCase,
    @Inject(GetRoomStateUseCase) private readonly getRoomState: GetRoomStateUseCase,
    @Inject(RemoveItemUseCase) private readonly removeItem: RemoveItemUseCase,
  ) {}

  @Post('queue')
  add(
    @Param('roomId', ParseUUIDPipe) roomId: string,
    @Body(new ZodValidationPipe(internalAddVideoSchema)) body: InternalAddVideo,
  ) {
    return this.addVideo.execute({ roomId, ...body });
  }

  @Get('state')
  state(@Param('roomId', ParseUUIDPipe) roomId: string) {
    return this.getRoomState.execute(roomId);
  }

  @Delete('queue/:itemId')
  @HttpCode(204)
  async remove(
    @Param('roomId', ParseUUIDPipe) roomId: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Query(new ZodValidationPipe(removeQuerySchema)) query: RemoveQuery,
  ): Promise<void> {
    await this.removeItem.execute({ roomId, itemId, ...query });
  }
}
