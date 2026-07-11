import { context, metrics, propagation, trace } from '@opentelemetry/api';
import { logs } from '@opentelemetry/api-logs';
import { AsyncLocalStorageContextManager } from '@opentelemetry/context-async-hooks';
import { W3CTraceContextPropagator } from '@opentelemetry/core';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { BatchLogRecordProcessor, LoggerProvider } from '@opentelemetry/sdk-logs';
import { MeterProvider, PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { BatchSpanProcessor, NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions';

/**
 * Vendor-neutral observability bootstrap (ADR-011): every service speaks OTLP
 * to the Collector; backends are the Collector's exporter config, not code.
 *
 * Deliberately NOT auto-instrumentations-node: ESM loader hooks fight tsx and
 * make tracing depend on module-load order. Instead we instrument the four
 * edges by hand — HTTP server (middleware), internal HTTP client, bus publish,
 * bus consume — which is deterministic, testable, and exactly the W3C
 * traceparent propagation story CLAUDE.md §10 promises.
 *
 * Call FIRST in main.ts (before Nest bootstrap). No-op unless OTEL_ENABLED=1,
 * so daily dev stays light; instruments created later resolve through the
 * global api and become no-ops too.
 */
export function startOtel(serviceName: string): { shutdown: () => Promise<void> } {
  if (process.env.OTEL_ENABLED !== '1' && process.env.OTEL_ENABLED !== 'true') {
    return { shutdown: async () => undefined };
  }

  const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? 'http://localhost:4318';
  const resource = resourceFromAttributes({ [ATTR_SERVICE_NAME]: serviceName });

  const tracerProvider = new NodeTracerProvider({
    resource,
    spanProcessors: [
      new BatchSpanProcessor(new OTLPTraceExporter({ url: `${endpoint}/v1/traces` })),
    ],
  });
  tracerProvider.register({
    contextManager: new AsyncLocalStorageContextManager().enable(),
    propagator: new W3CTraceContextPropagator(),
  });

  const meterProvider = new MeterProvider({
    resource,
    readers: [
      new PeriodicExportingMetricReader({
        exporter: new OTLPMetricExporter({ url: `${endpoint}/v1/metrics` }),
        exportIntervalMillis: 15_000,
      }),
    ],
  });
  metrics.setGlobalMeterProvider(meterProvider);

  const loggerProvider = new LoggerProvider({
    resource,
    processors: [
      new BatchLogRecordProcessor({
        exporter: new OTLPLogExporter({ url: `${endpoint}/v1/logs` }),
      }),
    ],
  });
  logs.setGlobalLoggerProvider(loggerProvider);

  return {
    shutdown: async () => {
      await Promise.allSettled([
        tracerProvider.shutdown(),
        meterProvider.shutdown(),
        loggerProvider.shutdown(),
      ]);
    },
  };
}

/** Stamp the active trace context onto outgoing headers (HTTP or AMQP). */
export function injectTraceHeaders(headers: Record<string, unknown> = {}): Record<string, unknown> {
  propagation.inject(context.active(), headers);
  return headers;
}

export {
  context as otelContext,
  metrics as otelMetrics,
  propagation as otelPropagation,
  trace as otelTrace,
};
