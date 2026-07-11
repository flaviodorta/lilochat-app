import { Body, Controller, Get, Inject, Patch, UseGuards } from '@nestjs/common';
import {
  updateProfileBodySchema,
  type UpdateProfileBody,
  type UserProfile,
} from '@lilochat/contracts';
import { ZodValidationPipe } from '@lilochat/nest-shared';
import { IdentityClient } from '../clients/identity.client.js';
import { CurrentUser } from '../security/current-user.decorator.js';
import { JwtAuthGuard, type AuthenticatedUser } from '../security/jwt-auth.guard.js';

/** `me` is resolved here from the verified JWT — clients never pass raw user ids. */
@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(@Inject(IdentityClient) private readonly identity: IdentityClient) {}

  @Get('me')
  getMe(@CurrentUser() user: AuthenticatedUser): Promise<UserProfile> {
    return this.identity.getProfile(user.id);
  }

  @Patch('me')
  updateMe(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(updateProfileBodySchema)) body: UpdateProfileBody,
  ): Promise<UserProfile> {
    return this.identity.updateNickname(user.id, body);
  }
}
