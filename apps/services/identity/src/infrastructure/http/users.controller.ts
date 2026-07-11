import { Body, Controller, Get, Inject, Param, ParseUUIDPipe, Patch } from '@nestjs/common';
import {
  updateProfileBodySchema,
  type UpdateProfileBody,
  type UserProfile,
} from '@lilochat/contracts';
import { ZodValidationPipe } from '@lilochat/nest-shared';
import { GetProfileUseCase } from '../../application/get-profile.usecase.js';
import { UpdateNicknameUseCase } from '../../application/update-nickname.usecase.js';

/** Internal API: the gateway resolves `me` → :id from the verified JWT before calling here. */
@Controller('users')
export class UsersController {
  constructor(
    @Inject(GetProfileUseCase) private readonly getProfileUseCase: GetProfileUseCase,
    @Inject(UpdateNicknameUseCase) private readonly updateNicknameUseCase: UpdateNicknameUseCase,
  ) {}

  @Get(':id')
  getProfile(@Param('id', ParseUUIDPipe) id: string): Promise<UserProfile> {
    return this.getProfileUseCase.execute(id);
  }

  @Patch(':id/nickname')
  updateNickname(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updateProfileBodySchema)) body: UpdateProfileBody,
  ): Promise<UserProfile> {
    return this.updateNicknameUseCase.execute({ userId: id, nickname: body.nickname });
  }
}
