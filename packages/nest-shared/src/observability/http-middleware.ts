import { performance } from 'node:perf_hooks';
import { context, metrics, propagation, SpanKind, SpanStatusCode, trace } from '@opentelemetry/api';
import type { NextFunction, Request, Response } from 'express';

/**
 * RED metrics + a SERVER span per request (§4.1 read/write latency SLIs).
 * Health probes are skipped — they'd dominate every rate() with noise.
 * The span name/route resolve on finish, when express has matched the route
 * pattern (so `/rooms/:id`, not one series per UUID — cardinality survives).
 */
export function otelHttpMiddleware(serviceName: string) {
  const tracer = trace.getTracer(serviceName);
  const duration = metrics.getMeter(serviceName).createHistogram('http.server.request.duration', {
    unit: 'ms',
    description: 'HTTP server request duration by route',
  });

  return (req: Request, res: Response, next: NextFunction): void => {
    if (req.path.startsWith('/health/')) {
      next();
      return;
    }

    const startedAt = performance.now();
    const parent = propagation.extract(context.active(), req.headers);
    const span = tracer.startSpan(
      `${req.method}`,
      { kind: SpanKind.SERVER, attributes: { 'url.path': req.path } },
      parent,
    );

    res.on('finish', () => {
      const route = `${req.baseUrl ?? ''}${req.route?.path ?? ''}` || 'unmatched';
      const attributes = {
        'http.request.method': req.method,
        'http.route': route,
        'http.response.status_code': res.statusCode,
      };
      duration.record(performance.now() - startedAt, attributes);
      span.updateName(`${req.method} ${route}`);
      span.setAttributes(attributes);
      if (res.statusCode >= 500) span.setStatus({ code: SpanStatusCode.ERROR });
      span.end();
    });

    context.with(trace.setSpan(parent, span), next);
  };
}
