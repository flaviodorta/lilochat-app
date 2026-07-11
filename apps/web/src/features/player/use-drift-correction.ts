'use client';

import { useEffect, type RefObject } from 'react';
import type { PlaybackState } from '@lilochat/contracts';
import { positionSeconds } from '@/features/rooms/use-server-clock';
import type { PlayerHandle } from './youtube-player';

/** §6.2 drift policy — the fix for the legacy app's biggest flaw. */
const IGNORE_UNDER_S = 1; // imperceptible
const HARD_SEEK_OVER_S = 3; // rebuffer/lag — jump
const NUDGE_UP = 1.05; // soft catch-up, invisible to the user
const NUDGE_DOWN = 0.95;
const SAMPLE_EVERY_TICKS = 60; // drift telemetry ~1/min (§4.1 sync-drift SLI)

export function useDriftCorrection(
  playerRef: RefObject<PlayerHandle | null>,
  playback: PlaybackState | null,
  serverNowMs: () => number,
  onSample?: (driftMs: number) => void,
) {
  useEffect(() => {
    if (!playback) return;
    let tick = 0;

    const timer = setInterval(() => {
      const player = playerRef.current;
      if (!player?.isPlaying()) return;
      const actual = player.getCurrentTime();
      if (actual === null) return;

      const expected = positionSeconds(serverNowMs(), playback.startedAt, playback.durationS);
      const drift = actual - expected; // + ahead of the room, − behind

      tick += 1;
      if (tick % SAMPLE_EVERY_TICKS === 0) onSample?.(Math.round(drift * 1000));

      if (Math.abs(drift) > HARD_SEEK_OVER_S) {
        player.seekTo(expected);
        player.setPlaybackRate(1);
      } else if (Math.abs(drift) > IGNORE_UNDER_S) {
        player.setPlaybackRate(drift > 0 ? NUDGE_DOWN : NUDGE_UP);
      } else {
        player.setPlaybackRate(1);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [playerRef, playback, serverNowMs, onSample]);
}
