import 'dotenv/config';
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { LOGGER, type Logger } from '@lilochat/nest-shared';
import { AppModule } from './app.module.js';
import { RTG_CONFIG, type RtgConfig } from './config.js';
import { setupRealtime } from './setup.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { logger: ['error', 'warn'] });
  app.enableShutdownHooks();

  const config = app.get<RtgConfig>(RTG_CONFIG);
  const logger = app.get<Logger>(LOGGER);

  await setupRealtime(app);
  await app.listen(config.PORT);
  logger.info({ port: config.PORT }, 'realtime-gateway up');
}

void bootstrap();
