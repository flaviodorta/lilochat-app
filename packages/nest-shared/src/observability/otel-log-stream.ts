import { ROOT_CONTEXT, TraceFlags, trace } from '@opentelemetry/api';
import { logs, SeverityNumber } from '@opentelemetry/api-logs';

/** pino numeric levels → OTel severity. */
const SEVERITY: Record<number, { number: SeverityNumber; text: string }> = {
  10: { number: SeverityNumber.TRACE, text: 'TRACE' },
  20: { number: SeverityNumber.DEBUG, text: 'DEBUG' },
  30: { number: SeverityNumber.INFO, text: 'INFO' },
  40: { number: SeverityNumber.WARN, text: 'WARN' },
  50: { number: SeverityNumber.ERROR, text: 'ERROR' },
  60: { number: SeverityNumber.FATAL, text: 'FATAL' },
};

const OMIT = new Set(['level', 'time', 'msg', 'pid', 'hostname', 'name', 'trace_id', 'span_id']);

/**
 * A pino destination that re-emits each line through the OTel Logs API
 * (→ Collector → Loki). trace_id/span_id from the logger mixin are rebuilt
 * into a span context so Loki records carry REAL trace correlation (the
 * Grafana logs↔traces jump), not just a string field.
 */
export function otelLogStream(name: string): { write: (line: string) => void } {
  return {
    write(line: string): void {
      try {
        // resolved per write: this stream is created inside @Module decorators,
        // which ESM evaluates before startOtel registers the global provider
        const logger = logs.getLogger(name);
        const record = JSON.parse(line) as Record<string, unknown>;
        const severity = SEVERITY[record.level as number] ?? SEVERITY[30]!;

        const attributes: Record<string, string | number | boolean> = {};
        for (const [key, value] of Object.entries(record)) {
          if (OMIT.has(key) || value === undefined || value === null) continue;
          attributes[key] =
            typeof value === 'object'
              ? JSON.stringify(value)
              : (value as string | number | boolean);
        }

        const traceId = record.trace_id as string | undefined;
        const spanId = record.span_id as string | undefined;
        const context =
          traceId && spanId
            ? trace.setSpanContext(ROOT_CONTEXT, {
                traceId,
                spanId,
                traceFlags: TraceFlags.SAMPLED,
                isRemote: true,
              })
            : undefined;

        logger.emit({
          timestamp: (record.time as number | undefined) ?? Date.now(),
          severityNumber: severity.number,
          severityText: severity.text,
          body: String(record.msg ?? ''),
          attributes,
          context,
        });
      } catch {
        // never let telemetry break logging
      }
    },
  };
}
