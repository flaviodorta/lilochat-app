import {
  Inject,
  Injectable,
  UnauthorizedException,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import type { Request } from 'express';
import jwt from 'jsonwebtoken';
import { GATEWAY_CONFIG, type GatewayConfig } from '../config.js';

export interface AuthenticatedUser {
  id: string;
  nickname: string;
}

export interface AuthenticatedRequest extends Request {
  user: AuthenticatedUser;
}

/** Verifies the RS256 access token with identity's public key — no shared secrets. */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  private readonly publicKeyPem: string;

  constructor(@Inject(GATEWAY_CONFIG) config: GatewayConfig) {
    this.publicKeyPem = Buffer.from(config.JWT_PUBLIC_KEY, 'base64').toString('utf8');
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const bearer = request.headers.authorization?.replace(/^Bearer\s+/i, '');
    if (!bearer) throw new UnauthorizedException({ code: 'MISSING_ACCESS_TOKEN' });

    try {
      const claims = jwt.verify(bearer, this.publicKeyPem, {
        algorithms: ['RS256'],
        issuer: 'lilochat-identity',
        audience: 'lilochat',
      }) as jwt.JwtPayload;
      request.user = { id: claims.sub as string, nickname: claims.nickname as string };
      return true;
    } catch {
      throw new UnauthorizedException({ code: 'INVALID_ACCESS_TOKEN' });
    }
  }
}
