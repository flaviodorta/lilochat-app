export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4100';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code?: string,
    message?: string,
  ) {
    super(message ?? `Request failed with ${status}`);
  }
}

interface ApiOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  accessToken?: string;
}

/** Gateway client: JSON in/out, cookies included (the refresh cookie needs them). */
export async function api<T>(path: string, options: ApiOptions = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method: options.method ?? 'GET',
      credentials: 'include',
      headers: {
        ...(options.body !== undefined ? { 'content-type': 'application/json' } : {}),
        ...(options.accessToken ? { authorization: `Bearer ${options.accessToken}` } : {}),
      },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
  } catch {
    // fetch itself failed: API down or CORS-blocked origin — say so, loudly
    throw new ApiError(0, 'NETWORK_UNREACHABLE', `Cannot reach the API at ${API_URL}`);
  }

  if (response.status === 204) return undefined as T;
  const data: unknown = await response.json().catch(() => ({}));
  if (!response.ok) {
    const err = data as { code?: string; message?: string };
    throw new ApiError(response.status, err.code, err.message);
  }
  return data as T;
}

export function avatarUrl(seed: string): string {
  return `${API_URL}/avatars/${encodeURIComponent(seed)}.svg`;
}
