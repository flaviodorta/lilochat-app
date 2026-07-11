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
import { ENGAGEMENT_CONFIG, type EngagementConfig } from './config.js';

async function bootstrap(): Promise<void> {
  startOtel('engagement'); // ADR-011 — before Nest so every instrument resolves the real provider
  const app = await NestFactory.create(AppModule, { logger: ['error', 'warn'] });
  app.enableShutdownHooks();
  app.use(otelHttpMiddleware('engagement'));

  const config = app.get<EngagementConfig>(ENGAGEMENT_CONFIG);
  const logger = app.get<Logger>(LOGGER);
  installProcessGuards(logger); // survive infra-blip rejections; die on true unknowns (6.5 drill)

  await app.listen(config.PORT);
  logger.info({ port: config.PORT }, 'engagement service up');
}

void bootstrap();
