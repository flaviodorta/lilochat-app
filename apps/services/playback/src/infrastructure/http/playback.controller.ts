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
import { VoteEngine } from '../../application/vote-engine.js';
import { GetRoomStateUseCase } from '../../application/get-room-state.usecase.js';
import { RemoveItemUseCase } from '../../application/remove-item.usecase.js';

/** Internal API — the gateway injects the authenticated user's id/nickname. */
const internalAddVideoSchema = addToQueueBodySchema.extend({
  addedById: z.string().uuid(),
  addedByNickname: nicknameSchema,
});
type InternalAddVideo = z.infer<typeof internalAddVideoSchema>;

const startVoteSchema = z.object({ startedBy: z.string().uuid() });
type StartVote = z.infer<typeof startVoteSchema>;
const castVoteSchema = z.object({ userId: z.string().uuid() });
type CastVote = z.infer<typeof castVoteSchema>;

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
    @Inject(VoteEngine) private readonly voteEngine: VoteEngine,
  ) {}

  @Post('votes')
  startVote(
    @Param('roomId', ParseUUIDPipe) roomId: string,
    @Body(new ZodValidationPipe(startVoteSchema)) body: StartVote,
  ) {
    return this.voteEngine.start(roomId, body.startedBy);
  }

  @Post('votes/:voteId/cast')
  @HttpCode(200)
  castVote(
    @Param('roomId', ParseUUIDPipe) roomId: string,
    @Param('voteId', ParseUUIDPipe) voteId: string,
    @Body(new ZodValidationPipe(castVoteSchema)) body: CastVote,
  ) {
    return this.voteEngine.cast(roomId, voteId, body.userId);
  }

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
