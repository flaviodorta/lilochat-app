import { HttpException } from '@nestjs/common';
import { injectTraceHeaders } from '@lilochat/nest-shared';

/**
 * Internal service call: JSON in/out, downstream error bodies pass through
 * unchanged (the gateway adds edge concerns, it does not rewrite domain errors).
 * The active trace context rides along as W3C traceparent (§10) — the edge
 * span and the service span join into one trace.
 */
export async function internalRequest<T>(
  baseUrl: string,
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const headers = injectTraceHeaders(
    body === undefined ? {} : { 'content-type': 'application/json' },
  ) as Record<string, string>;

  const response = await fetch(`${baseUrl.replace(/\/$/, '')}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (response.status === 204) return undefined as T;
  const data: unknown = await response.json().catch(() => ({}));
  if (!response.ok) throw new HttpException(data as object, response.status);
  return data as T;
}
