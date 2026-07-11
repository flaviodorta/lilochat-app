import 'dotenv/config';
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { LOGGER, type Logger } from '@lilochat/nest-shared';
import { AppModule } from './app.module.js';
import { CHAT_CONFIG, type ChatConfig } from './config.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { logger: ['error', 'warn'] });
  app.enableShutdownHooks();

  const config = app.get<ChatConfig>(CHAT_CONFIG);
  const logger = app.get<Logger>(LOGGER);

  await app.listen(config.PORT);
  logger.info({ port: config.PORT }, 'chat service up');
}

void bootstrap();
