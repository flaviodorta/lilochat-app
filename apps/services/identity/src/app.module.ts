import { Module } from '@nestjs/common';
import { HealthModule, LoggerModule, TypedConfigModule } from '@lilochat/nest-shared';
import { IDENTITY_CONFIG, identityEnvSchema } from './config.js';
import { IdentityModule } from './infrastructure/identity.module.js';
import { PrismaModule } from './infrastructure/prisma/prisma.module.js';
import { PrismaService } from './infrastructure/prisma/prisma.service.js';

@Module({
  imports: [
    TypedConfigModule.forRoot({ token: IDENTITY_CONFIG, schema: identityEnvSchema }),
    LoggerModule.forRoot({ name: 'identity', pretty: process.env.NODE_ENV === 'development' }),
    PrismaModule,
    IdentityModule,
    HealthModule.forRoot({
      imports: [PrismaModule],
      checks: {
        useFactory: (prisma: PrismaService) => [
          {
            name: 'postgres',
            check: async () => {
              await prisma.$queryRaw`SELECT 1`;
            },
          },
        ],
        inject: [PrismaService],
      },
    }),
  ],
})
export class AppModule {}
