'use client';

import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import type { PlaybackState, QueueItem } from '@lilochat/contracts';
import { Header } from '@/components/header';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/features/auth/auth-context';
import { Avatar } from '@/features/auth/avatar';
import { YouTubePlayer, type PlayerHandle } from '@/features/player/youtube-player';
import { useDriftCorrection } from '@/features/player/use-drift-correction';
import { getRoom } from '@/features/rooms/api';
import { AddVideoModal } from '@/features/rooms/add-video-modal';
import { useRoomSync } from '@/features/rooms/use-room-sync';
import { formatClock, positionSeconds } from '@/features/rooms/use-server-clock';

export function RoomView({ roomId }: { roomId: string }) {
  const { accessToken, status, openAuthModal } = useAuth();

  const detailQuery = useQuery({
    queryKey: ['room', roomId],
    queryFn: () => getRoom(roomId),
    refetchOnWindowFocus: false,
  });
  const { playback, queue, serverNowMs } = useRoomSync(roomId, detailQuery.data, accessToken);

  if (detailQuery.isLoading) {
    return (
      <>
        <Header />
        <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
          <div className="aspect-video max-w-4xl animate-pulse rounded-xl bg-surface-raised/60" />
        </main>
      </>
    );
  }
  if (detailQuery.isError || !detailQuery.data) {
    return (
      <>
        <Header />
        <main className="mx-auto flex max-w-7xl flex-col items-center gap-3 px-4 py-24 text-center">
          <p className="text-lg font-medium text-zinc-300">This room does not exist (anymore).</p>
        </main>
      </>
    );
  }

  const room = detailQuery.data;

  return (
    <>
      <Header />
      <main className="mx-auto grid max-w-7xl grid-cols-1 gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[1fr_380px]">
        <div className="flex min-w-0 flex-col gap-4">
          <PlayerZone
            roomName={room.name}
            viewers={room.viewers}
            playback={playback}
            serverNowMs={serverNowMs}
          />
          <QueuePanel
            roomId={roomId}
            queue={queue}
            canAdd={status === 'authenticated'}
            onNeedAuth={() => openAuthModal('signin')}
          />
        </div>

        {/* Chat lands here in Phase 3 (roadmap 3.6) */}
        <aside className="hidden h-fit flex-col gap-2 rounded-xl border border-edge bg-surface p-5 lg:flex">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">Chat</h2>
          <p className="py-10 text-center text-sm text-zinc-500">💬 Live chat arrives in Phase 3</p>
        </aside>
      </main>
    </>
  );
}

function PlayerZone({
  roomName,
  viewers,
  playback,
  serverNowMs,
}: {
  roomName: string;
  viewers: number;
  playback: PlaybackState | null;
  serverNowMs: () => number;
}) {
  const playerRef = useRef<PlayerHandle | null>(null);
  const [muted, setMuted] = useState(true);
  useDriftCorrection(playerRef, playback, serverNowMs);

  // room advanced to another video → load it at the right position
  const currentItem = useRef<string | null>(null);
  useEffect(() => {
    if (!playback) return;
    if (currentItem.current && currentItem.current !== playback.itemId) {
      playerRef.current?.loadVideo(
        playback.videoId,
        positionSeconds(serverNowMs(), playback.startedAt, playback.durationS),
      );
    }
    currentItem.current = playback.itemId;
  }, [playback, serverNowMs]);

  return (
    <div className="flex flex-col gap-3">
      <div className="relative aspect-video overflow-hidden rounded-xl bg-black">
        {playback ? (
          <>
            <YouTubePlayer
              ref={playerRef}
              videoId={playback.videoId}
              startSeconds={positionSeconds(serverNowMs(), playback.startedAt, playback.durationS)}
              onBuffered={() => {
                // §6.2: after buffering, hard-resync instead of drifting back slowly
                playerRef.current?.seekTo(
                  positionSeconds(serverNowMs(), playback.startedAt, playback.durationS),
                );
              }}
            />
            {muted && (
              <button
                type="button"
                onClick={() => {
                  playerRef.current?.unMute();
                  playerRef.current?.setVolume(80);
                  setMuted(false);
                }}
                className="absolute inset-x-0 bottom-6 mx-auto w-fit rounded-full bg-black/80 px-5 py-2.5 text-sm font-medium text-white backdrop-blur transition-transform hover:scale-105"
              >
                🔊 Tap to unmute
              </button>
            )}
            <div className="pointer-events-none absolute left-3 top-3 flex items-center gap-2">
              <span className="rounded bg-black/60 px-2 py-1 text-xs font-semibold text-white backdrop-blur">
                {roomName}
              </span>
              <span className="flex items-center gap-1 rounded bg-live/90 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                <span className="size-1.5 animate-pulse rounded-full bg-white" /> Live
              </span>
            </div>
          </>
        ) : (
          <div className="flex size-full flex-col items-center justify-center gap-2 text-zinc-500">
            <p className="text-lg">This room is idle</p>
            <p className="text-sm">Add a video below to start the channel 🎬</p>
          </div>
        )}
      </div>

      {playback && (
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate font-medium text-zinc-100">{playback.title}</p>
            <PositionTicker playback={playback} serverNowMs={serverNowMs} />
          </div>
          <span className="shrink-0 rounded bg-surface px-2 py-1 text-xs font-medium text-positive">
            👥 {viewers} watching
          </span>
        </div>
      )}
    </div>
  );
}

/** Visible, offset-corrected room position — also the flagship test's sync probe. */
function PositionTicker({
  playback,
  serverNowMs,
}: {
  playback: PlaybackState;
  serverNowMs: () => number;
}) {
  const [position, setPosition] = useState(0);
  useEffect(() => {
    const tick = () =>
      setPosition(positionSeconds(serverNowMs(), playback.startedAt, playback.durationS));
    tick();
    const timer = setInterval(tick, 250);
    return () => clearInterval(timer);
  }, [playback, serverNowMs]);

  return (
    <p
      className="font-mono text-xs tabular-nums text-zinc-500"
      data-testid="sync-position"
      data-videoid={playback.videoId}
      data-position-s={position.toFixed(2)}
    >
      {formatClock(position)} / {formatClock(playback.durationS)}
    </p>
  );
}

function QueuePanel({
  roomId,
  queue,
  canAdd,
  onNeedAuth,
}: {
  roomId: string;
  queue: QueueItem[];
  canAdd: boolean;
  onNeedAuth: () => void;
}) {
  const [adding, setAdding] = useState(false);

  return (
    <section className="rounded-xl border border-edge bg-surface p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">
          Up next · {queue.length}
        </h2>
        <Button
          size="sm"
          variant="outline"
          onClick={() => (canAdd ? setAdding(true) : onNeedAuth())}
        >
          + Add video
        </Button>
      </div>

      {queue.length === 0 ? (
        <p className="py-6 text-center text-sm text-zinc-500">
          Queue is empty — the room goes idle when this video ends.
        </p>
      ) : (
        <ul className="flex flex-col gap-2" data-testid="queue-list">
          {queue.map((item) => (
            <li
              key={item.itemId}
              className="flex items-center gap-3 rounded-lg border border-transparent p-2 transition-colors hover:border-edge hover:bg-surface-raised/50"
            >
              <img src={item.thumbUrl} alt="" className="h-12 w-20 shrink-0 rounded object-cover" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-zinc-200">{item.title}</p>
                <p className="text-xs text-zinc-500">{formatClock(item.durationS)}</p>
              </div>
              <span title={`added by ${item.addedByNickname}`}>
                <Avatar seed={item.addedByNickname} size="sm" />
              </span>
            </li>
          ))}
        </ul>
      )}

      <AddVideoModal roomId={roomId} open={adding} onClose={() => setAdding(false)} />
    </section>
  );
}
