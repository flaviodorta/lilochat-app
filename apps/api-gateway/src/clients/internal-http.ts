import { HttpException } from '@nestjs/common';

/**
 * Internal service call: JSON in/out, downstream error bodies pass through
 * unchanged (the gateway adds edge concerns, it does not rewrite domain errors).
 */
export async function internalRequest<T>(
  baseUrl: string,
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const response = await fetch(`${baseUrl.replace(/\/$/, '')}${path}`, {
    method,
    headers: body === undefined ? undefined : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (response.status === 204) return undefined as T;
  const data: unknown = await response.json().catch(() => ({}));
  if (!response.ok) throw new HttpException(data as object, response.status);
  return data as T;
}
