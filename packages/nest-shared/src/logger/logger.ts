import type { DynamicModule } from '@nestjs/common';
import { trace } from '@opentelemetry/api';
import pino, { type Logger } from 'pino';
import pretty from 'pino-pretty';
import { otelLogStream } from '../observability/otel-log-stream.js';

export const LOGGER: unique symbol = Symbol('LILOCHAT_LOGGER');

export interface LoggerOptions {
  /** Service name, stamped on every log line. */
  name: string;
  level?: 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';
  /** Human-readable output for local dev; prod stays structured JSON. */
  pretty?: boolean;
}

export function createLogger(options: LoggerOptions): Logger {
  const level = options.level ?? 'info';
  const streams: pino.StreamEntry[] = [
    { level, stream: options.pretty ? pretty({ colorize: true }) : process.stdout },
  ];
  if (process.env.OTEL_ENABLED === '1' || process.env.OTEL_ENABLED === 'true') {
    streams.push({ level, stream: otelLogStream(options.name) });
  }

  return pino(
    {
      name: options.name,
      level,
      // trace correlation (§10): every line inside a span carries its ids,
      // both on stdout and in the OTLP records shipped to Loki.
      mixin: () => {
        const span = trace.getActiveSpan();
        if (!span) return {};
        const { traceId, spanId } = span.spanContext();
        return { trace_id: traceId, span_id: spanId };
      },
    },
    pino.multistream(streams),
  );
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
