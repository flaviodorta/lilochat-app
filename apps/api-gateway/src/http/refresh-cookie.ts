import type { Request, Response } from 'express';

export const REFRESH_COOKIE = 'lilo_rt';
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * The refresh token never reaches client-side JS: httpOnly cookie scoped to
 * /auth so the browser only attaches it where it is needed (CLAUDE.md §7.1).
 */
export function setRefreshCookie(response: Response, token: string, secure: boolean): void {
  response.cookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure,
    path: '/auth',
    maxAge: THIRTY_DAYS_MS,
  });
}

export function clearRefreshCookie(response: Response): void {
  response.clearCookie(REFRESH_COOKIE, { path: '/auth' });
}

export function readRefreshToken(request: Request): string | undefined {
  const cookies = request.cookies as Record<string, string> | undefined;
  const fromCookie = cookies?.[REFRESH_COOKIE];
  if (fromCookie) return fromCookie;
  // body fallback keeps the API usable by non-browser clients (mobile, curl)
  const body = request.body as { refreshToken?: string } | undefined;
  return body?.refreshToken;
}
