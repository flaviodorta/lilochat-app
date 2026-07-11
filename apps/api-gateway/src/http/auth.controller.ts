import {
  Body,
  Controller,
  HttpCode,
  Inject,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import {
  loginBodySchema,
  registerBodySchema,
  type AuthSession,
  type LoginBody,
  type RegisterBody,
} from '@lilochat/contracts';
import { ZodValidationPipe } from '@lilochat/nest-shared';
import { IdentityClient } from '../clients/identity.client.js';
import { GATEWAY_CONFIG, type GatewayConfig } from '../config.js';
import { clearRefreshCookie, readRefreshToken, setRefreshCookie } from './refresh-cookie.js';

/** Public auth session: everything except the refresh token (which lives in the cookie). */
type PublicSession = Omit<AuthSession, 'refreshToken'>;

@Controller('auth')
export class AuthController {
  private readonly cookieSecure: boolean;

  constructor(
    @Inject(IdentityClient) private readonly identity: IdentityClient,
    @Inject(GATEWAY_CONFIG) config: GatewayConfig,
  ) {
    this.cookieSecure = config.NODE_ENV === 'production';
  }

  @Post('register')
  async register(
    @Body(new ZodValidationPipe(registerBodySchema)) body: RegisterBody,
    @Res({ passthrough: true }) response: Response,
  ): Promise<PublicSession> {
    return this.toPublicSession(await this.identity.register(body), response);
  }

  @Post('login')
  @HttpCode(200)
  async login(
    @Body(new ZodValidationPipe(loginBodySchema)) body: LoginBody,
    @Res({ passthrough: true }) response: Response,
  ): Promise<PublicSession> {
    return this.toPublicSession(await this.identity.login(body), response);
  }

  @Post('refresh')
  @HttpCode(200)
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<PublicSession> {
    const refreshToken = readRefreshToken(request);
    if (!refreshToken) throw new UnauthorizedException({ code: 'MISSING_REFRESH_TOKEN' });

    try {
      return this.toPublicSession(await this.identity.refresh(refreshToken), response);
    } catch (error) {
      clearRefreshCookie(response); // a dead cookie must not keep 401-ing the client
      throw error;
    }
  }

  @Post('logout')
  @HttpCode(204)
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    const refreshToken = readRefreshToken(request);
    if (refreshToken) await this.identity.logout(refreshToken);
    clearRefreshCookie(response);
  }

  private toPublicSession(session: AuthSession, response: Response): PublicSession {
    setRefreshCookie(response, session.refreshToken, this.cookieSecure);
    return {
      user: session.user,
      accessToken: session.accessToken,
      accessTokenExpiresIn: session.accessTokenExpiresIn,
    };
  }
}
