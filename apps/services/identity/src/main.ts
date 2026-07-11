import 'dotenv/config';
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { LOGGER, type Logger } from '@lilochat/nest-shared';
import { AppModule } from './app.module.js';
import { IDENTITY_CONFIG, type IdentityConfig } from './config.js';

async function bootstrap(): Promise<void> {
  // Keep Nest's console logger for errors/warnings: with `logger: false` a DI
  // failure at boot dies completely silently (learned the hard way).
  const app = await NestFactory.create(AppModule, { logger: ['error', 'warn'] });
  app.enableShutdownHooks(); // graceful shutdown: drain in-flight requests on SIGTERM

  const config = app.get<IdentityConfig>(IDENTITY_CONFIG);
  const logger = app.get<Logger>(LOGGER);

  await app.listen(config.PORT);
  logger.info({ port: config.PORT }, 'identity service up');
}

void bootstrap();
