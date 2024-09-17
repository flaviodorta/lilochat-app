'use client';

import { useInfinityRoomsQuery } from '@/hooks/use-infinity-rooms-query';
import { useRef, useCallback, useEffect, useState } from 'react';
import { Room } from '@/types/rooms';
import Spinner from './spinner';
import RoomCard from './room-card';
import supabaseCreateClient from '@/utils/supabase/supabase-client';
import axios from 'axios';

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

  const supabase = supabaseCreateClient();

  useEffect(() => {
    const updateUserRoomId = async (roomId: string | null) => {
      const { error: addUserToRoomError } = await supabase
        .from('users')
        .update({ room_id: roomId })
        .eq('id', userId);

      if (addUserToRoomError) {
        console.error('Erro ao atualizar o room_id:', addUserToRoomError);
      }
    };

    updateUserRoomId(null);
  }, []);

  if (error) return <p>Erro ao carregar salas</p>;

  return (
    <div className='w-full px-8 md:px-0 container grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 mt-[160px] gap-8'>
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

      <div className='flex w-full h-full justify-center items-center'>
        {isFetchingNextPage && <Spinner />}
      </div>
    </div>
  );
};

export default RoomsList;
