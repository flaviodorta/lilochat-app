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
import { PLAYBACK_CONFIG, type PlaybackConfig } from './config.js';

async function bootstrap(): Promise<void> {
  startOtel('playback'); // ADR-011 — before Nest so every instrument resolves the real provider
  const app = await NestFactory.create(AppModule, { logger: ['error', 'warn'] });
  app.enableShutdownHooks();
  app.use(otelHttpMiddleware('playback'));

  const config = app.get<PlaybackConfig>(PLAYBACK_CONFIG);
  const logger = app.get<Logger>(LOGGER);
  installProcessGuards(logger); // survive infra-blip rejections; die on true unknowns (6.5 drill)

  await app.listen(config.PORT);
  logger.info({ port: config.PORT }, 'playback service up');
}

void bootstrap();
