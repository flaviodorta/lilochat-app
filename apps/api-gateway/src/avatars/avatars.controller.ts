import { BadRequestException, Controller, Get, Header, Inject, Param } from '@nestjs/common';
import { AvatarService } from './avatar.service.js';

const FILE_PATTERN = /^([a-zA-Z0-9_-]{1,64})\.svg$/;

@Controller('avatars')
export class AvatarsController {
  constructor(@Inject(AvatarService) private readonly avatars: AvatarService) {}

  /** `GET /avatars/:seed.svg` — long-lived browser/CDN caching: avatars are pure functions of the seed. */
  @Get(':file')
  @Header('Content-Type', 'image/svg+xml')
  @Header('Cache-Control', 'public, max-age=2592000, immutable')
  getAvatar(@Param('file') file: string): Promise<string> {
    const match = FILE_PATTERN.exec(file);
    if (!match?.[1]) {
      throw new BadRequestException({
        code: 'INVALID_AVATAR_SEED',
        message: 'Expected <seed>.svg',
      });
    }
    return this.avatars.getSvg(match[1]);
  }
}
