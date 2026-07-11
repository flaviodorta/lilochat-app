'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import type {
  PlaybackStartedPayload,
  PlaybackState,
  QueueItem,
  QueueUpdatedPayload,
  RoomDetail,
  SyncPong,
} from '@lilochat/contracts';

export const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? 'http://localhost:4110';

const SYNC_SAMPLES = 5;
const RESAMPLE_MS = 30_000;
const EWMA_ALPHA = 0.4;

export interface RoomSync {
  playback: PlaybackState | null;
  queue: QueueItem[];
  connected: boolean;
  /** Server clock, offset-corrected (WS NTP-style when connected, REST otherwise). */
  serverNowMs: () => number;
}

/**
 * The client half of §6.2: subscribes to the room's broadcasts and keeps an
 * EWMA clock offset from sync:ping/pong (offset ≈ serverNow − (sent + rtt/2)).
 * Initial state comes from the REST snapshot; reconnects re-apply it — a
 * reload lands in-sync by construction.
 */
export function useRoomSync(
  roomId: string,
  detail: RoomDetail | undefined,
  accessToken: string | null,
): RoomSync {
  const [playback, setPlayback] = useState<PlaybackState | null>(null);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [connected, setConnected] = useState(false);
  const offsetMs = useRef(0);

  // REST snapshot seeds state + a coarse offset (good even for guests, no WS)
  useEffect(() => {
    if (!detail) return;
    setPlayback(detail.playback);
    setQueue(detail.queue);
    offsetMs.current = new Date(detail.serverNow).getTime() - Date.now();
  }, [detail]);

  useEffect(() => {
    if (!accessToken) return;

    const socket: Socket = io(`${WS_URL}/room`, {
      auth: { token: accessToken },
      transports: ['websocket'],
    });

    const ping = () => socket.emit('sync:ping', { clientSentAt: Date.now() });

    socket.on('connect', () => {
      setConnected(true);
      socket.emit('room:join', { roomId }, () => undefined);
      for (let i = 0; i < SYNC_SAMPLES; i += 1) setTimeout(ping, i * 400); // burst, then steady
    });
    socket.on('disconnect', () => setConnected(false));

    socket.on('sync:pong', (pong: SyncPong) => {
      const rtt = Date.now() - pong.clientSentAt;
      const sample = pong.serverNow - (pong.clientSentAt + rtt / 2);
      offsetMs.current = offsetMs.current * (1 - EWMA_ALPHA) + sample * EWMA_ALPHA;
    });
    const resample = setInterval(ping, RESAMPLE_MS);

    socket.on('playback:started', (payload: PlaybackStartedPayload) => {
      if (payload.roomId !== roomId) return;
      setPlayback({
        itemId: payload.itemId,
        videoId: payload.videoId,
        title: payload.title,
        thumbUrl: payload.thumbUrl,
        durationS: payload.durationS,
        startedAt: payload.startedAt,
      });
    });
    socket.on('queue:updated', (payload: QueueUpdatedPayload) => {
      if (payload.roomId !== roomId) return;
      setQueue(payload.queue);
    });

    return () => {
      clearInterval(resample);
      socket.disconnect();
    };
  }, [roomId, accessToken]);

  const serverNowMs = useCallback(() => Date.now() + offsetMs.current, []);

  return { playback, queue, connected, serverNowMs };
}
