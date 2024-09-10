'use client';

import { useInfinityRoomsQuery } from '@/hooks/use-infinity-rooms-query';
import { useRef, useCallback } from 'react';
import { Room } from '@/types/rooms';
import Spinner from './spinner';
import RoomCard from './room-card';

const RoomsList = ({ userId }: { userId?: string }) => {
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, error } =
    useInfinityRoomsQuery();
  const observerRef = useRef<IntersectionObserver | null>(null);

  const lastRoomElementRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (isFetchingNextPage) return;
      if (observerRef.current) observerRef.current.disconnect();

      observerRef.current = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && hasNextPage) {
          fetchNextPage();
        }
      });

      if (node) observerRef.current.observe(node);
    },
    [isFetchingNextPage, hasNextPage, fetchNextPage]
  );

  if (error) return <p>Erro ao carregar salas</p>;

  // console.log(data);

  return (
    <div className='w-full container mx-auto grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 mt-[160px] gap-8'>
      {data?.pages.map((page, pageIndex) =>
        page.data.map((room: Room, index: number) => {
          const isLastRoom =
            pageIndex === data.pages.length - 1 &&
            index === page.data.length - 1;

          return (
            <RoomCard
              key={room.id}
              userId={userId}
              lastRoomElementRef={isLastRoom ? lastRoomElementRef : null}
              room={room}
            />
          );
        })
      )}

      {isFetchingNextPage && <Spinner />}
    </div>
  );
};

export default RoomsList;
