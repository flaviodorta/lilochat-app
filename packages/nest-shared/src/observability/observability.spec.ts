import { EventEmitter } from 'node:events';
import { context, metrics, propagation, ROOT_CONTEXT, trace } from '@opentelemetry/api';
import { logs } from '@opentelemetry/api-logs';
import { AsyncLocalStorageContextManager } from '@opentelemetry/context-async-hooks';
import { W3CTraceContextPropagator } from '@opentelemetry/core';
import {
  InMemoryLogRecordExporter,
  LoggerProvider,
  SimpleLogRecordProcessor,
} from '@opentelemetry/sdk-logs';
import {
  AggregationTemporality,
  InMemoryMetricExporter,
  MeterProvider,
  PeriodicExportingMetricReader,
} from '@opentelemetry/sdk-metrics';
import {
  InMemorySpanExporter,
  NodeTracerProvider,
  SimpleSpanProcessor,
} from '@opentelemetry/sdk-trace-node';
import type { Request, Response } from 'express';
import { beforeAll, describe, expect, it } from 'vitest';
import { otelHttpMiddleware } from './http-middleware.js';
import { otelLogStream } from './otel-log-stream.js';
import { injectTraceHeaders } from './otel.js';

const spans = new InMemorySpanExporter();
const metricExporter = new InMemoryMetricExporter(AggregationTemporality.CUMULATIVE);
const metricReader = new PeriodicExportingMetricReader({
  exporter: metricExporter,
  exportIntervalMillis: 60 * 60 * 1000, // flushed manually
});
const logRecords = new InMemoryLogRecordExporter();

beforeAll(() => {
  const tracerProvider = new NodeTracerProvider({
    spanProcessors: [new SimpleSpanProcessor(spans)],
  });
  tracerProvider.register({
    contextManager: new AsyncLocalStorageContextManager().enable(),
    propagator: new W3CTraceContextPropagator(),
  });
  metrics.setGlobalMeterProvider(new MeterProvider({ readers: [metricReader] }));
  logs.setGlobalLoggerProvider(
    new LoggerProvider({ processors: [new SimpleLogRecordProcessor({ exporter: logRecords })] }),
  );
});

describe('W3C traceparent propagation (§10)', () => {
  it('publish-side inject → consume-side extract lands in the SAME trace', () => {
    const tracer = trace.getTracer('test');
    const span = tracer.startSpan('publisher');

    // what RabbitMqBus.publish stamps on the message…
    const headers = context.with(trace.setSpan(context.active(), span), () => injectTraceHeaders());
    span.end();
    expect(String(headers.traceparent)).toContain(span.spanContext().traceId);

    // …and what bindConsumer recovers on the other side of the bus
    const restored = propagation.extract(ROOT_CONTEXT, headers);
    expect(trace.getSpanContext(restored)?.traceId).toBe(span.spanContext().traceId);
  });
});

describe('otelHttpMiddleware', () => {
  it('records the RED histogram by ROUTE PATTERN and emits a server span', async () => {
    const middleware = otelHttpMiddleware('test-service');

    const req = {
      method: 'GET',
      path: '/rooms/1c8b6c3a-0000-4000-8000-000000000000',
      headers: {},
      baseUrl: '',
      route: { path: '/rooms/:id' }, // set by express AFTER routing — read on finish
    } as unknown as Request;
    const res = new EventEmitter() as unknown as Response;
    (res as { statusCode: number }).statusCode = 200;

    let sawActiveSpan = false;
    middleware(req, res, () => {
      sawActiveSpan = trace.getActiveSpan() !== undefined; // handlers run inside the span
    });
    (res as unknown as EventEmitter).emit('finish');

    expect(sawActiveSpan).toBe(true);
    const span = spans.getFinishedSpans().find((s) => s.name === 'GET /rooms/:id');
    expect(span?.attributes['http.response.status_code']).toBe(200);

    await metricReader.forceFlush();
    const metric = metricExporter
      .getMetrics()
      .flatMap((rm) => rm.scopeMetrics)
      .flatMap((sm) => sm.metrics)
      .find((m) => m.descriptor.name === 'http.server.request.duration');
    expect(metric).toBeDefined();
    const point = metric!.dataPoints.find((dp) => dp.attributes['http.route'] === '/rooms/:id');
    expect(point).toBeDefined();
  });

  it('skips health probes entirely', () => {
    const middleware = otelHttpMiddleware('test-service');
    const before = spans.getFinishedSpans().length;
    const req = { method: 'GET', path: '/health/ready', headers: {} } as unknown as Request;
    const res = new EventEmitter() as unknown as Response;
    let called = false;
    middleware(req, res, () => {
      called = true;
    });
    (res as unknown as EventEmitter).emit('finish');
    expect(called).toBe(true);
    expect(spans.getFinishedSpans().length).toBe(before);
  });
});

describe('otelLogStream', () => {
  it('re-emits pino lines as OTLP records with REAL trace correlation', () => {
    const traceId = 'abcdefabcdefabcdefabcdefabcdef12';
    const spanId = 'abcdefabcdef1234';
    otelLogStream('test-service').write(
      JSON.stringify({
        level: 40,
        time: 1750000000000,
        msg: 'outbox relay tick failed',
        err: { message: 'boom' },
        trace_id: traceId,
        span_id: spanId,
      }),
    );

    const record = logRecords
      .getFinishedLogRecords()
      .find((r) => r.body === 'outbox relay tick failed');
    expect(record).toBeDefined();
    expect(record?.severityText).toBe('WARN');
    expect(record?.spanContext?.traceId).toBe(traceId); // the Loki→Tempo jump
    expect(record?.attributes.err).toBe('{"message":"boom"}');
  });

  it('never throws on garbage lines', () => {
    expect(() => otelLogStream('test-service').write('not json at all')).not.toThrow();
  });
});
