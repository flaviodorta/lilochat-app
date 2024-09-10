'use client';

import { useInfinityRoomsQuery } from '@/hooks/use-infinity-rooms-query';
import { useRef, useEffect, useCallback } from 'react';
import { Room } from '@/types/rooms';
import Spinner from './spinner';
import RoomCard from './room-card';
import { useVirtualizer } from '@tanstack/react-virtual';

const RoomsList = ({ userId }: { userId?: string }) => {
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, error } =
    useInfinityRoomsQuery();
  const parentRef = useRef<HTMLDivElement>(null);

  // Flatten all pages of rooms
  const allRooms = data ? data.pages.flatMap((page) => page.data) : [];

  // Virtualizer setup
  const roomVirtualizer = useVirtualizer({
    count: hasNextPage ? allRooms.length + 1 : allRooms.length, // Account for loading row
    getScrollElement: () => parentRef.current,
    estimateSize: () => 150, // Approximate height of each RoomCard
    overscan: 5,
  });

  // Handle fetching the next page when scrolling reaches the end
  useEffect(() => {
    const [lastItem] = [...roomVirtualizer.getVirtualItems()].reverse();

    if (!lastItem) return;

    if (
      lastItem.index >= allRooms.length - 1 && // Last item in the list
      hasNextPage &&
      !isFetchingNextPage
    ) {
      fetchNextPage();
    }
  }, [
    hasNextPage,
    fetchNextPage,
    allRooms.length,
    isFetchingNextPage,
    roomVirtualizer.getVirtualItems(),
  ]);

  if (error) return <p>Erro ao carregar salas</p>;

  return (
    <div className='w-full h-[500px] overflow-y-auto' ref={parentRef}>
      <div
        style={{
          height: `${roomVirtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {roomVirtualizer.getVirtualItems().map((virtualRow) => {
          const isLoaderRow = virtualRow.index > allRooms.length - 1;
          const room = allRooms[virtualRow.index];

          return (
            <div
              key={virtualRow.index}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: `${virtualRow.size}px`,
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              {isLoaderRow ? (
                hasNextPage ? (
                  'Carregando mais salas...'
                ) : (
                  'Nada mais para carregar'
                )
              ) : (
                <RoomCard
                  key={room.id}
                  userId={userId}
                  lastRoomElementRef={null} // Não precisa mais do lastRoomElementRef
                  room={room}
                />
              )}
            </div>
          );
        })}
      </div>

      {isFetchingNextPage && <Spinner />}
    </div>
  );
};

export default RoomsList;
