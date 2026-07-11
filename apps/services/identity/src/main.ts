import 'dotenv/config';
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import {
  installProcessGuards,
  LOGGER,
  otelHttpMiddleware,
  startOtel,
  type Logger,
} from '@lilochat/nest-shared';
import { AppModule } from './app.module.js';
import { IDENTITY_CONFIG, type IdentityConfig } from './config.js';

async function bootstrap(): Promise<void> {
  startOtel('identity'); // ADR-011 — before Nest so every instrument resolves the real provider
  // Keep Nest's console logger for errors/warnings: with `logger: false` a DI
  // failure at boot dies completely silently (learned the hard way).
  const app = await NestFactory.create(AppModule, { logger: ['error', 'warn'] });
  app.enableShutdownHooks();
  app.use(otelHttpMiddleware('identity'));

  const config = app.get<IdentityConfig>(IDENTITY_CONFIG);
  const logger = app.get<Logger>(LOGGER);
  installProcessGuards(logger); // survive infra-blip rejections; die on true unknowns (6.5 drill)

  await app.listen(config.PORT);
  logger.info({ port: config.PORT }, 'identity service up');
}

void bootstrap();
