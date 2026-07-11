import { randomUUID } from 'node:crypto';
import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { GetProfileUseCase } from '../application/get-profile.usecase.js';
import { LoginUseCase } from '../application/login.usecase.js';
import { LogoutUseCase } from '../application/logout.usecase.js';
import { RefreshUseCase } from '../application/refresh.usecase.js';
import { RegisterUseCase } from '../application/register.usecase.js';
import { TokenIssuer } from '../application/token-issuer.js';
import { UpdateNicknameUseCase } from '../application/update-nickname.usecase.js';
import type {
  Clock,
  IdGenerator,
  PasswordHasher,
  RefreshTokenGenerator,
  RefreshTokenRepository,
  UserRepository,
} from '../domain/ports.js';
import { IDENTITY_CONFIG, type IdentityConfig } from '../config.js';
import { Argon2PasswordHasher } from './adapters/argon2-password.hasher.js';
import { CryptoRefreshTokenGenerator } from './adapters/crypto-refresh-token.generator.js';
import { JwtAccessTokenSigner } from './adapters/jwt-access-token.signer.js';
import { AuthController } from './http/auth.controller.js';
import { DomainErrorFilter } from './http/domain-error.filter.js';
import { UsersController } from './http/users.controller.js';
import { PrismaRefreshTokenRepository } from './prisma/prisma-refresh-token.repository.js';
import { PrismaUserRepository } from './prisma/prisma-user.repository.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { PrismaService } from './prisma/prisma.service.js';

// DI tokens for hexagonal ports — domain/application stay framework-free;
// this module is the composition root wiring ports to adapters.
export const USER_REPOSITORY = Symbol('USER_REPOSITORY');
export const REFRESH_TOKEN_REPOSITORY = Symbol('REFRESH_TOKEN_REPOSITORY');
export const PASSWORD_HASHER = Symbol('PASSWORD_HASHER');
export const REFRESH_TOKEN_GENERATOR = Symbol('REFRESH_TOKEN_GENERATOR');
export const CLOCK = Symbol('CLOCK');
export const ID_GENERATOR = Symbol('ID_GENERATOR');

@Module({
  imports: [PrismaModule],
  controllers: [AuthController, UsersController],
  providers: [
    { provide: APP_FILTER, useClass: DomainErrorFilter },
    {
      provide: USER_REPOSITORY,
      useFactory: (prisma: PrismaService) => new PrismaUserRepository(prisma),
      inject: [PrismaService],
    },
    {
      provide: REFRESH_TOKEN_REPOSITORY,
      useFactory: (prisma: PrismaService) => new PrismaRefreshTokenRepository(prisma),
      inject: [PrismaService],
    },
    { provide: PASSWORD_HASHER, useValue: new Argon2PasswordHasher() },
    { provide: REFRESH_TOKEN_GENERATOR, useValue: new CryptoRefreshTokenGenerator() },
    { provide: CLOCK, useValue: { now: () => new Date() } satisfies Clock },
    { provide: ID_GENERATOR, useValue: { next: () => randomUUID() } satisfies IdGenerator },
    {
      provide: TokenIssuer,
      useFactory: (
        config: IdentityConfig,
        refreshTokens: RefreshTokenRepository,
        generator: RefreshTokenGenerator,
        clock: Clock,
        ids: IdGenerator,
      ) =>
        new TokenIssuer({
          signer: new JwtAccessTokenSigner(
            Buffer.from(config.JWT_PRIVATE_KEY, 'base64').toString('utf8'),
            config.ACCESS_TOKEN_TTL_SEC,
          ),
          refreshTokens,
          generator,
          clock,
          ids,
          refreshTtlDays: config.REFRESH_TOKEN_TTL_DAYS,
        }),
      inject: [
        IDENTITY_CONFIG,
        REFRESH_TOKEN_REPOSITORY,
        REFRESH_TOKEN_GENERATOR,
        CLOCK,
        ID_GENERATOR,
      ],
    },
    {
      provide: RegisterUseCase,
      useFactory: (
        users: UserRepository,
        hasher: PasswordHasher,
        tokens: TokenIssuer,
        clock: Clock,
        ids: IdGenerator,
      ) => new RegisterUseCase({ users, hasher, tokens, clock, ids }),
      inject: [USER_REPOSITORY, PASSWORD_HASHER, TokenIssuer, CLOCK, ID_GENERATOR],
    },
    {
      provide: LoginUseCase,
      useFactory: (users: UserRepository, hasher: PasswordHasher, tokens: TokenIssuer) =>
        new LoginUseCase({ users, hasher, tokens }),
      inject: [USER_REPOSITORY, PASSWORD_HASHER, TokenIssuer],
    },
    {
      provide: RefreshUseCase,
      useFactory: (
        users: UserRepository,
        refreshTokens: RefreshTokenRepository,
        generator: RefreshTokenGenerator,
        tokens: TokenIssuer,
        clock: Clock,
      ) => new RefreshUseCase({ users, refreshTokens, generator, tokens, clock }),
      inject: [
        USER_REPOSITORY,
        REFRESH_TOKEN_REPOSITORY,
        REFRESH_TOKEN_GENERATOR,
        TokenIssuer,
        CLOCK,
      ],
    },
    {
      provide: LogoutUseCase,
      useFactory: (
        refreshTokens: RefreshTokenRepository,
        generator: RefreshTokenGenerator,
        clock: Clock,
      ) => new LogoutUseCase({ refreshTokens, generator, clock }),
      inject: [REFRESH_TOKEN_REPOSITORY, REFRESH_TOKEN_GENERATOR, CLOCK],
    },
    {
      provide: GetProfileUseCase,
      useFactory: (users: UserRepository) => new GetProfileUseCase({ users }),
      inject: [USER_REPOSITORY],
    },
    {
      provide: UpdateNicknameUseCase,
      useFactory: (users: UserRepository, clock: Clock) =>
        new UpdateNicknameUseCase({ users, clock }),
      inject: [USER_REPOSITORY, CLOCK],
    },
  ],
})
export class IdentityModule {}
