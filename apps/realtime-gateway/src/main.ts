import 'dotenv/config';
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { LOGGER, otelHttpMiddleware, startOtel, type Logger } from '@lilochat/nest-shared';
import { AppModule } from './app.module.js';
import { RTG_CONFIG, type RtgConfig } from './config.js';
import { setupRealtime } from './setup.js';

async function bootstrap(): Promise<void> {
  startOtel('realtime-gateway'); // ADR-011 — before Nest so every instrument resolves the real provider
  const app = await NestFactory.create(AppModule, { logger: ['error', 'warn'] });
  app.enableShutdownHooks();
  app.use(otelHttpMiddleware('realtime-gateway'));

  const config = app.get<RtgConfig>(RTG_CONFIG);
  const logger = app.get<Logger>(LOGGER);

  await setupRealtime(app);
  await app.listen(config.PORT);
  logger.info({ port: config.PORT }, 'realtime-gateway up');
}

void bootstrap();
