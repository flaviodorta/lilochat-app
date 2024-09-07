'use client';

import { useRooms } from '@/hooks/use-rooms';
import ReactPlayer from 'react-player';
import { useRef, useCallback, useState } from 'react';
import { Room } from '@/types/rooms';
import Image from 'next/image';
import { Spinner } from '@chakra-ui/react';
import { FaUsers } from 'react-icons/fa6';

const RoomsList = () => {
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, error } =
    useRooms();
  const observerRef = useRef<IntersectionObserver | null>(null);
  const [hoveredRoomId, setHoveredRoomId] = useState<string | null>(null); // Estado para controlar o hover

  // Função para observar o último elemento e carregar mais dados
  const lastRoomElementRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (isFetchingNextPage) return;
      if (observerRef.current) observerRef.current.disconnect();

      observerRef.current = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && hasNextPage) {
          fetchNextPage(); // Carrega a próxima página quando o último item estiver visível
        }
      });

      if (node) observerRef.current.observe(node); // Começa a observar o último item
    },
    [isFetchingNextPage, hasNextPage, fetchNextPage]
  );

  if (error) return <p>Erro ao carregar salas</p>;

  return (
    <div className='w-3/4 grid grid-cols-1 xl:grid-cols-2 mt-[160px] gap-10'>
      {data?.pages.map((page, pageIndex) => (
        <div key={pageIndex}>
          {page.data.map((room: Room, index: number) => {
            const isLastRoom =
              pageIndex === data.pages.length - 1 &&
              index === page.data.length - 1;

            return (
              <div
                key={index}
                className='flex min-w-[250px] gap-10 justify-center'
              >
                <div
                  key={room.id}
                  className='relative shadow-md mb-10 w-fit flex rounded-2xl overflow-hidden'
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
                      <div className='absolute w-[350px] h-[250px]'>
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
                      <div className='flex items-center gap-2'>
                        <FaUsers />
                        <span>1/32</span>
                      </div>

                      <button className='px-4 button w-fit'>Enter</button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ))}

      {isFetchingNextPage && (
        <Spinner
          thickness='4px'
          speed='0.65s'
          emptyColor='purple.600'
          color='purple.600'
          size='xl'
        />
      )}
    </div>
  );
};

export default RoomsList;
