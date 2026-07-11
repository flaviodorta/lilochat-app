import { Body, Controller, HttpCode, Inject, Post } from '@nestjs/common';
import {
  loginBodySchema,
  refreshBodySchema,
  registerBodySchema,
  type LoginBody,
  type RefreshBody,
  type RegisterBody,
} from '@lilochat/contracts';
import { ZodValidationPipe } from '@lilochat/nest-shared';
import type { AuthSession } from '../../application/auth-session.js';
import { LoginUseCase } from '../../application/login.usecase.js';
import { LogoutUseCase } from '../../application/logout.usecase.js';
import { RefreshUseCase } from '../../application/refresh.usecase.js';
import { RegisterUseCase } from '../../application/register.usecase.js';

// Explicit @Inject: DI must not rely on emitDecoratorMetadata under single-file
// transpilers (tsx/esbuild) — and it keeps these imports as value imports.
@Controller('auth')
export class AuthController {
  constructor(
    @Inject(RegisterUseCase) private readonly registerUseCase: RegisterUseCase,
    @Inject(LoginUseCase) private readonly loginUseCase: LoginUseCase,
    @Inject(RefreshUseCase) private readonly refreshUseCase: RefreshUseCase,
    @Inject(LogoutUseCase) private readonly logoutUseCase: LogoutUseCase,
  ) {}

  @Post('register')
  register(
    @Body(new ZodValidationPipe(registerBodySchema)) body: RegisterBody,
  ): Promise<AuthSession> {
    return this.registerUseCase.execute(body);
  }

  @Post('login')
  @HttpCode(200)
  login(@Body(new ZodValidationPipe(loginBodySchema)) body: LoginBody): Promise<AuthSession> {
    return this.loginUseCase.execute(body);
  }

  @Post('refresh')
  @HttpCode(200)
  refresh(@Body(new ZodValidationPipe(refreshBodySchema)) body: RefreshBody): Promise<AuthSession> {
    return this.refreshUseCase.execute(body);
  }

  @Post('logout')
  @HttpCode(204)
  async logout(@Body(new ZodValidationPipe(refreshBodySchema)) body: RefreshBody): Promise<void> {
    await this.logoutUseCase.execute(body);
  }
}
