import type { DynamicModule } from '@nestjs/common';
import pino, { type Logger } from 'pino';

export const LOGGER: unique symbol = Symbol('LILOCHAT_LOGGER');

export interface LoggerOptions {
  /** Service name, stamped on every log line. */
  name: string;
  level?: 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';
  /** Human-readable output for local dev; prod stays structured JSON. */
  pretty?: boolean;
}

export function createLogger(options: LoggerOptions): Logger {
  return pino({
    name: options.name,
    level: options.level ?? 'info',
    transport: options.pretty ? { target: 'pino-pretty', options: { colorize: true } } : undefined,
  });
}

export class LoggerModule {
  static forRoot(options: LoggerOptions): DynamicModule {
    return {
      module: LoggerModule,
      global: true,
      providers: [{ provide: LOGGER, useValue: createLogger(options) }],
      exports: [LOGGER],
    };
  }
}
