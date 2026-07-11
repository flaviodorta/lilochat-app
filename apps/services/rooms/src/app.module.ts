import { Module } from '@nestjs/common';
import {
  HealthModule,
  LoggerModule,
  MessagingModule,
  TypedConfigModule,
} from '@lilochat/nest-shared';
import { ROOMS_CONFIG, roomsEnvSchema, type RoomsConfig } from './config.js';
import { RoomsModule } from './infrastructure/rooms.module.js';
import { PrismaModule } from './infrastructure/prisma/prisma.module.js';
import { PrismaService } from './infrastructure/prisma/prisma.service.js';

@Module({
  imports: [
    TypedConfigModule.forRoot({ token: ROOMS_CONFIG, schema: roomsEnvSchema }),
    LoggerModule.forRoot({ name: 'rooms', pretty: process.env.NODE_ENV === 'development' }),
    MessagingModule.forRootAsync({
      useFactory: (config: RoomsConfig) => ({ url: config.RABBITMQ_URL }),
      inject: [ROOMS_CONFIG],
    }),
    PrismaModule,
    RoomsModule,
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
