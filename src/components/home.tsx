'use client';

import { useInfinityRoomsQuery } from '@/hooks/use-infinity-rooms-query';
import { useRef, useCallback, useEffect, useState } from 'react';
import { Room } from '@/types/rooms';
import Spinner from './spinner';
import RoomCard from './room-card';
import supabaseCreateClient from '@/utils/supabase/supabase-client';
import { User } from '@/types/user';
import Header from './header';
import { debounce } from 'lodash';

const Home = ({ user }: { user: User | null }) => {
  const [searchKeyword, setSearchKeyword] = useState('');
  const [debouncedKeyword, setDebouncedKeyword] = useState(searchKeyword);

  const debounceSetKeyword = debounce((value: string) => {
    setDebouncedKeyword(value);
  }, 500);

  useEffect(() => {
    debounceSetKeyword(searchKeyword);

    return () => {
      debounceSetKeyword.cancel();
    };
  }, [searchKeyword]);

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, error } =
    useInfinityRoomsQuery(debouncedKeyword);

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
    if (!user) return;

    const updateUserRoomId = async (roomId: string | null) => {
      const { error: addUserToRoomError } = await supabase
        .from('users')
        .update({ room_id: roomId })
        .eq('id', user.id);

      if (addUserToRoomError) {
        console.error('Erro ao atualizar o room_id:', addUserToRoomError);
      }
    };

    updateUserRoomId(null);
  }, []);

  if (error) return <p>Erro ao carregar salas</p>;

  return (
    <>
      <Header user={user} setSearchKeyword={setSearchKeyword} />

      <div className='w-full px-8 md:px-0 container grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 mt-[160px] gap-8'>
        {data?.pages.map((page, pageIndex) =>
          page.data.map((room: Room, index: number) => {
            const isLastRoom =
              pageIndex === data.pages.length - 1 &&
              index === page.data.length - 1;

            return (
              <RoomCard
                key={room.id}
                order={`${pageIndex * 10 + index + 1}`}
                userId={user?.id}
                lastRoomElementRef={isLastRoom ? lastRoomElementRef : null}
                room={room}
              />
            );
          })
        )}

        {isFetchingNextPage && (
          <div className='flex w-full h-full justify-center items-center'>
            <Spinner />
          </div>
        )}
      </div>
    </>
  );
};

export default Home;
