'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { RoomCard as RoomCardData } from '@lilochat/contracts';
import { cn } from '@/lib/cn';
import { formatClock, positionSeconds } from './use-server-clock';

/**
 * The storefront card (CLAUDE.md §12.2): resting shows thumb + name + LIVE +
 * viewers; on hover it "wakes up" — ticking exact timestamp + progress bar,
 * computed locally from `startedAt` (zero extra requests).
 */
export function RoomCard({ room, serverNowMs }: { room: RoomCardData; serverNowMs: () => number }) {
  const [hovered, setHovered] = useState(false);

  return (
    <Link
      href={`/room/${room.id}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={cn(
        'focus-ring group block overflow-hidden rounded-xl border border-edge bg-surface',
        'transition-all duration-200 hover:scale-[1.02] hover:border-brand/40 hover:glow-brand',
      )}
    >
      <div className="relative aspect-video bg-surface-raised">
        {room.video ? (
          // YouTube thumbnails: plain <img>, remote host, no Next optimization needed
          <img src={room.video.thumbUrl} alt="" className="size-full object-cover" loading="lazy" />
        ) : (
          <div className="flex size-full items-center justify-center border-b border-dashed border-edge text-sm text-zinc-500">
            Be the first — add a video
          </div>
        )}

        <div
          className={cn(
            'absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent p-3 pt-8',
            'transition-opacity',
          )}
        >
          {room.video && hovered && (
            <HoverDetails
              title={room.video.title}
              startedAt={room.video.startedAt}
              durationS={room.video.durationS}
              serverNowMs={serverNowMs}
            />
          )}
          <div className="flex items-center justify-between gap-2">
            <span className="truncate font-semibold text-white">{room.name}</span>
            <span className="flex shrink-0 items-center gap-2">
              {room.video && (
                <span className="flex items-center gap-1 rounded bg-live/90 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                  <span className="size-1.5 animate-pulse rounded-full bg-white" /> Live
                </span>
              )}
              <span className="rounded bg-black/50 px-1.5 py-0.5 text-xs font-medium text-positive">
                👥 {room.viewers}
              </span>
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}

function HoverDetails({
  title,
  startedAt,
  durationS,
  serverNowMs,
}: {
  title: string;
  startedAt: string;
  durationS: number;
  serverNowMs: () => number;
}) {
  const [position, setPosition] = useState(() =>
    positionSeconds(serverNowMs(), startedAt, durationS),
  );

  // ticks every second WHILE hovered — the §6.2 tuple makes this free
  useEffect(() => {
    const timer = setInterval(
      () => setPosition(positionSeconds(serverNowMs(), startedAt, durationS)),
      1000,
    );
    return () => clearInterval(timer);
  }, [startedAt, durationS, serverNowMs]);

  return (
    <div className="mb-2 flex flex-col gap-1.5">
      <p className="truncate text-xs text-zinc-300">{title}</p>
      <div className="flex items-center gap-2">
        <span className="font-mono text-xs tabular-nums text-white">
          {formatClock(position)} / {formatClock(durationS)}
        </span>
        <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/20">
          <div
            className="h-full rounded-full bg-gradient-to-r from-brand to-accent transition-[width] duration-1000 ease-linear"
            style={{ width: `${Math.min(100, (position / durationS) * 100)}%` }}
          />
        </div>
      </div>
    </div>
  );
}
