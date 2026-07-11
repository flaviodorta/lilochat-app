'use client';

import { useCallback, useRef } from 'react';

/**
 * Cheap server-clock offset (home page, pre-WebSocket): every REST payload
 * carries `serverNow`; offset ≈ serverNow − receivedAt. Good to ~RTT/2 —
 * plenty for a hover timestamp. The player's NTP-style WS sync (§6.2) is the
 * precise one.
 */
export function useServerClock() {
  const offsetMs = useRef(0);

  const observeServerNow = useCallback((serverNowIso: string) => {
    offsetMs.current = new Date(serverNowIso).getTime() - Date.now();
  }, []);

  const serverNowMs = useCallback(() => Date.now() + offsetMs.current, []);

  return { observeServerNow, serverNowMs };
}

/** Position within the current video, in seconds — pure §6.2 arithmetic. */
export function positionSeconds(
  serverNowMs: number,
  startedAtIso: string,
  durationS: number,
): number {
  const elapsed = (serverNowMs - new Date(startedAtIso).getTime()) / 1000;
  return Math.min(Math.max(elapsed, 0), durationS);
}

export function formatClock(totalSeconds: number): string {
  const s = Math.floor(totalSeconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = h > 0 ? String(m).padStart(2, '0') : String(m);
  return `${h > 0 ? `${h}:` : ''}${mm}:${String(sec).padStart(2, '0')}`;
}
