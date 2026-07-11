import 'dotenv/config';
import 'reflect-metadata';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { LOGGER, type Logger } from '@lilochat/nest-shared';
import { AppModule } from './app.module.js';
import { GATEWAY_CONFIG, type GatewayConfig } from './config.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: ['error', 'warn'],
  });
  app.enableShutdownHooks();

  const config = app.get<GatewayConfig>(GATEWAY_CONFIG);
  const logger = app.get<Logger>(LOGGER);

  // CORP relaxed: this API serves cross-origin resources (avatars) to the web
  // app — helmet's same-origin default makes browsers refuse the <img> embeds.
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(cookieParser());
  app.enableCors({
    origin: config.CORS_ORIGINS.split(',').map((origin) => origin.trim()),
    credentials: true, // the refresh cookie must survive cross-origin XHR from the web app
  });
  if (config.NODE_ENV === 'production') {
    app.set('trust proxy', 1); // Traefik terminates TLS in front of us
  }

  await app.listen(config.PORT);
  logger.info({ port: config.PORT }, 'api-gateway up');
}

void bootstrap();
