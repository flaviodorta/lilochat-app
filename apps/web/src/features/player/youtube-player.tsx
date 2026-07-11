'use client';

import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';

/**
 * Thin wrapper over the official YouTube IFrame Player API (ADR-007):
 * react-player can't do playbackRate drift-nudging + precise seekTo reliably.
 * All native controls hidden — the room, not the user, owns the timeline.
 */

/* Minimal typings for the slice of the IFrame API we use. */
interface YtPlayer {
  loadVideoById(videoId: string, startSeconds?: number): void;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  getCurrentTime(): number;
  getPlayerState(): number;
  setPlaybackRate(rate: number): void;
  playVideo(): void;
  mute(): void;
  unMute(): void;
  isMuted(): boolean;
  setVolume(volume: number): void;
  destroy(): void;
}
interface YtNamespace {
  Player: new (
    el: HTMLElement,
    opts: {
      videoId: string;
      playerVars: Record<string, number | string>;
      events: {
        onReady: (e: { target: YtPlayer }) => void;
        onStateChange: (e: { target: YtPlayer; data: number }) => void;
      };
    },
  ) => YtPlayer;
  PlayerState: {
    PLAYING: number;
    PAUSED: number;
    BUFFERING: number;
    ENDED: number;
    UNSTARTED: number;
  };
}
declare global {
  interface Window {
    YT?: YtNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let apiPromise: Promise<YtNamespace> | null = null;
function loadIframeApi(): Promise<YtNamespace> {
  if (apiPromise) return apiPromise;
  apiPromise = new Promise((resolve) => {
    if (window.YT?.Player) return resolve(window.YT);
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      resolve(window.YT as YtNamespace);
    };
    const script = document.createElement('script');
    script.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(script);
  });
  return apiPromise;
}

export interface PlayerHandle {
  seekTo(seconds: number): void;
  setPlaybackRate(rate: number): void;
  getCurrentTime(): number | null;
  isPlaying(): boolean;
  play(): void;
  mute(): void;
  unMute(): void;
  setVolume(volume: number): void;
  loadVideo(videoId: string, startSeconds: number): void;
}

export interface YouTubePlayerProps {
  videoId: string;
  startSeconds: number;
  onReady?: () => void;
  onBuffered?: () => void; // fired when playback resumes after buffering
  /** Nobody can pause (§3.2): fired if a pause slips through (OS media keys…). */
  onPaused?: () => void;
}

export const YouTubePlayer = forwardRef<PlayerHandle, YouTubePlayerProps>(function YouTubePlayer(
  { videoId, startSeconds, onReady, onBuffered, onPaused },
  ref,
) {
  const hostRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YtPlayer | null>(null);
  const wasBuffering = useRef(false);
  const initial = useRef({ videoId, startSeconds, onReady, onBuffered, onPaused });
  initial.current = { videoId, startSeconds, onReady, onBuffered, onPaused };

  useEffect(() => {
    let disposed = false;
    void loadIframeApi().then((yt) => {
      if (disposed || !hostRef.current) return;
      playerRef.current = new yt.Player(hostRef.current, {
        videoId: initial.current.videoId,
        playerVars: {
          autoplay: 1,
          mute: 1, // browsers block unmuted autoplay — "tap to unmute" is product UX (§6.2)
          controls: 0,
          disablekb: 1,
          rel: 0,
          iv_load_policy: 3,
          playsinline: 1,
          // declared origin = embed trust signal (also required for correct
          // postMessage security with the IFrame API)
          origin: window.location.origin,
          start: Math.floor(initial.current.startSeconds),
        },
        events: {
          onReady: (event) => {
            event.target.playVideo();
            initial.current.onReady?.();
          },
          onStateChange: (event) => {
            if (event.data === yt.PlayerState.BUFFERING) wasBuffering.current = true;
            if (event.data === yt.PlayerState.PLAYING && wasBuffering.current) {
              wasBuffering.current = false;
              initial.current.onBuffered?.();
            }
            if (event.data === yt.PlayerState.PAUSED) initial.current.onPaused?.();
          },
        },
      });
    });
    return () => {
      disposed = true;
      try {
        playerRef.current?.destroy();
      } catch {
        // already detached — fine
      }
      playerRef.current = null;
    };
  }, []);

  // every call guarded: the IFrame API throws if the player is mid-destroy
  const guarded = <T,>(fn: (player: YtPlayer) => T): T | null => {
    try {
      return playerRef.current ? fn(playerRef.current) : null;
    } catch {
      return null;
    }
  };

  useImperativeHandle(ref, () => ({
    seekTo: (seconds) => void guarded((p) => p.seekTo(seconds, true)),
    setPlaybackRate: (rate) => void guarded((p) => p.setPlaybackRate(rate)),
    getCurrentTime: () => guarded((p) => p.getCurrentTime()),
    isPlaying: () => guarded((p) => p.getPlayerState()) === window.YT?.PlayerState.PLAYING,
    play: () => void guarded((p) => p.playVideo()),
    mute: () => void guarded((p) => p.mute()),
    unMute: () => void guarded((p) => p.unMute()),
    setVolume: (volume) => void guarded((p) => p.setVolume(volume)),
    loadVideo: (id, start) => void guarded((p) => p.loadVideoById(id, Math.floor(start))),
  }));

  return <div ref={hostRef} className="size-full" />;
});
