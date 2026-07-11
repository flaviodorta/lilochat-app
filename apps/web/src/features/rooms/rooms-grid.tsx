'use client';

import { useInfiniteQuery } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { RoomCard } from './room-card';
import { listRooms } from './api';
import { useLobbyViewers } from './use-lobby';
import { useServerClock } from './use-server-clock';

/** Infinite-scroll directory (§7.1 keyset cursor + IntersectionObserver). */
export function RoomsGrid({ q }: { q?: string }) {
  const { observeServerNow, serverNowMs } = useServerClock();
  useLobbyViewers(); // live card patches from /lobby (§7.2)

  const query = useInfiniteQuery({
    queryKey: ['rooms', q ?? ''],
    queryFn: async ({ pageParam }) => {
      const page = await listRooms({ cursor: pageParam, q });
      observeServerNow(page.serverNow);
      return page;
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    refetchInterval: 30_000, // live-ish cards until the /lobby namespace (Phase 3)
  });

  const sentinelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && query.hasNextPage && !query.isFetchingNextPage) {
          void query.fetchNextPage();
        }
      },
      { rootMargin: '400px' },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [query]);

  const rooms = query.data?.pages.flatMap((page) => page.items) ?? [];

  if (query.isLoading) {
    return (
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 8 }, (_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    );
  }

  if (rooms.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-edge py-20 text-center">
        <p className="text-lg font-medium text-zinc-300">
          {q ? `No rooms match “${q}”` : 'No rooms yet'}
        </p>
        <p className="text-sm text-zinc-500">Be the one who opens the first channel 🎬</p>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
        {rooms.map((room) => (
          <RoomCard key={room.id} room={room} serverNowMs={serverNowMs} />
        ))}
      </div>
      <div ref={sentinelRef} className="h-px" />
      {query.isFetchingNextPage && (
        <p className="py-6 text-center text-sm text-zinc-500">Loading more rooms…</p>
      )}
    </>
  );
}

function SkeletonCard() {
  return (
    <div className="overflow-hidden rounded-xl border border-edge bg-surface">
      <div className="aspect-video animate-pulse bg-surface-raised/60" />
      <div className="flex flex-col gap-2 p-4">
        <div className="h-4 w-2/3 animate-pulse rounded bg-surface-raised/60" />
        <div className="h-3 w-1/3 animate-pulse rounded bg-surface-raised/40" />
      </div>
    </div>
  );
}
