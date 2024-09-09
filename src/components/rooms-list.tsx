'use client';

import { useRooms } from '@/hooks/use-rooms';
import ReactPlayer from 'react-player';
import { useRef, useCallback, useState } from 'react';
import { Room } from '@/types/rooms';
import Image from 'next/image';
import { FaUsers } from 'react-icons/fa6';
import { PiUsersThreeFill } from 'react-icons/pi';
import { useRouter } from 'next/navigation';
import Spinner from './spinner';
import supabaseCreateClient from '@/utils/supabase/supabase-client';
import { useToast } from '@chakra-ui/react';

const RoomsList = ({ userId }: { userId?: string }) => {
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, error } =
    useRooms();
  const observerRef = useRef<IntersectionObserver | null>(null);
  const [hoveredRoomId, setHoveredRoomId] = useState<string | null>(null);
  const supabase = supabaseCreateClient();

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

  const router = useRouter();

  const toast = useToast();

  const handleJoinRoom = async (roomId: string, userId?: string) => {
    if (!userId) {
      toast({
        duration: 5000,
        title: 'Log in to account first',
        status: 'info',
      });
    }
    try {
      const { error } = await supabase
        .from('users')
        .update({ room_id: roomId })
        .eq('id', userId);

      if (error) {
        console.error('Erro ao atualizar o room_id:', error);
      } else {
        console.log('Usuário atualizado com sucesso.');
        router.push('/room/' + roomId);
      }
    } catch (error) {
      console.error('Erro inesperado ao entrar na sala:', error);
    }
  };

  if (error) return <p>Erro ao carregar salas</p>;

  return (
    <div className='w-[90%] xl:w-3/4 grid grid-cols-1 xl:grid-cols-2 mt-[160px] gap-10'>
      {data?.pages.map((page, pageIndex) => (
        <div key={pageIndex}>
          {page.data.map((room: Room, index: number) => {
            const isLastRoom =
              pageIndex === data.pages.length - 1 &&
              index === page.data.length - 1;

            return (
              <div
                key={room.id}
                className='flex min-w-[250px] gap-10 justify-center'
              >
                <div
                  key={room.id}
                  className='relative shadow-md w-fit flex rounded-2xl overflow-hidden'
                  ref={isLastRoom ? lastRoomElementRef : null}
                >
                  <div
                    onMouseEnter={() => setHoveredRoomId(room.id)}
                    onMouseLeave={() => setHoveredRoomId(null)}
                    className='relative flex w-[350px] h-[250px]'
                  >
                    <Image
                      src={room.video_thumbnail_url}
                      alt={room.name}
                      layout='fill'
                      objectFit='cover'
                    />

                    {hoveredRoomId === room.id && (
                      <div className='absolute w-full h-full'>
                        <ReactPlayer
                          url={room.video_url!}
                          playing={hoveredRoomId === room.id}
                          muted={true}
                          controls={false}
                          width='100%'
                          height='100%'
                          config={{
                            youtube: {
                              playerVars: {
                                autoplay: 1,
                                mute: 0,
                                controls: 0,
                                modestbranding: 1,
                                rel: 0,
                                showinfo: 0,
                              },
                            },
                          }}
                        />
                      </div>
                    )}
                  </div>

                  <div className='bg-white font-bold flex flex-col justify-between p-4 w-[300px] h-[250px]'>
                    <h2 className=''>{room.name}</h2>

                    <div className='flex justify-between'>
                      <div className='flex text-lg items-center gap-2'>
                        <PiUsersThreeFill />
                        <span className='text-ellipsis'>1/32</span>
                      </div>

                      <button
                        className='px-4 button-2 text-white py-2 w-fit'
                        onClick={() => handleJoinRoom(room.id, userId)}
                      >
                        Join
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ))}

      {isFetchingNextPage && <Spinner />}
    </div>
  );
};

export default RoomsList;
