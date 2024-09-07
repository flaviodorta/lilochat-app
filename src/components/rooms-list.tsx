import { useRooms } from '@/hooks/use-rooms';
import ReactPlayer from 'react-player';
import { useRef, useCallback } from 'react';
import { Room } from '@/types/rooms';

const RoomsList = () => {
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, error } =
    useRooms();
  const observerRef = useRef<IntersectionObserver | null>(null);

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
    <div className='grid grid-cols-3'>
      {data?.pages.map((page, pageIndex) => (
        <div key={pageIndex}>
          {page.data.map((room: Room, index: number) => {
            const isLastRoom =
              pageIndex === data.pages.length - 1 &&
              index === page.data.length - 1;

            return (
              <div
                key={room.id}
                className='room-card'
                ref={isLastRoom ? lastRoomElementRef : null} // Conecta o último item ao observer
              >
                <ReactPlayer
                  url={room.video_url!}
                  playing={room.video_is_playing}
                  controls={true}
                  width='100%'
                  height='100%'
                />
                <div className='room-details'>
                  <h2>{room.name}</h2>
                </div>
              </div>
            );
          })}
        </div>
      ))}

      {isFetchingNextPage && <p>Carregando mais salas...</p>}
    </div>
  );
};

export default RoomsList;
