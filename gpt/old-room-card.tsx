import { Room } from '@/types/rooms';
import supabaseCreateClient from '@/utils/supabase/supabase-client';
import { useToast } from '@chakra-ui/react';
import { createBrowserClient } from '@supabase/ssr';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { FaUser, FaUsers } from 'react-icons/fa6';
import { PiUsersThreeFill } from 'react-icons/pi';
import ReactPlayer from 'react-player';

type Props = {
  // key: string;
  room: Room;
  userId: string | undefined;
  lastRoomElementRef: ((node: HTMLDivElement | null) => void) | null;
};

const RoomCard = ({ room, userId, lastRoomElementRef }: Props) => {
  const [isHovered, setIsHovered] = useState(false);
  const router = useRouter();
  const toast = useToast();

  const supabase = supabaseCreateClient();

  const handleJoinRoom = async (roomId: string, userId?: string) => {
    if (!userId) {
      toast({
        duration: 5000,
        title: 'Log in to account first',
        status: 'info',
      });
    }

    try {
      // setar o dono da sala
      const { data: usersInRoom, error: usersError } = await supabase
        .from('users')
        .select('id')
        .eq('room_id', roomId);

      // console.log('users na sala', usersInRoom);

      if (usersError) {
        console.error('Erro ao verificar usuários na sala:', usersError);
        return;
      }

      const usersCount = usersInRoom?.length || 0;

      // console.log('users count', usersCount);
      // console.log('user id', userId);

      if (usersCount === 0) {
        const { data: updateKingRoom, error: updateKingRoomError } =
          await supabase
            .from('rooms')
            .update({ user_id: userId })
            .eq('id', roomId);

        // console.log('update king user', updateKingRoom);
        // console.log('room id', roomId);

        if (updateKingRoomError) {
          console.error(
            'Erro ao atualizar o dono da sala',
            updateKingRoomError
          );
          return;
        }
        // console.log('Usuário se tornou o dono da sala', userId);
      }

      const { data: addUserToRoom, error: addUserToRoomError } = await supabase
        .from('users')
        .update({ room_id: roomId })
        .eq('id', userId);

      if (addUserToRoomError) {
        console.error('Erro ao atualizar o room_id:', addUserToRoomError);
      }
      router.push('/room/' + roomId);
    } catch (error) {
      console.error('Erro inesperado ao entrar na sala:', error);
    }
  };

  return (
    <div
      ref={lastRoomElementRef}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={() => handleJoinRoom(room.id, userId)}
      className='group mx-auto cursor-pointer relative mb-8 hover:cursor-pointer w-fit flex flex-col gap-4'
    >
      <div className='room-card relative overflow-hidden  group-hover:-translate-x-[6px] group-hover:-translate-y-[6px] group-hover:shadow-[2px_2px_0px_0px,_3px_3px_0px_0px,_4px_4px_0px_0px,_5px_5px_0px_0px,_6px_6px_0px_0px]'>
        <Image
          alt='image'
          width={300}
          height={200}
          src={room.video_thumbnail_url}
          className='border-l border-l-purple-600'
        />

        {isHovered && (
          <div className='absolute z-10 cursor-pointer left-0 top-0 w-full h-full'>
            <ReactPlayer
              url={room.video_url!}
              playing={isHovered}
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

        <div className='absolute bg-red-600/0 z-20 cursor-pointer left-0 top-0 w-full h-full' />

        <div className='absolute z-30 flex items-center text-green-600 gap-2 bg-neutral-50 px-3 py-0.5 top-2 left-2 rounded-full'>
          {/* <PiUsersThreeFill /> */}
          <FaUser />

          <span className='font-bold'>27</span>
        </div>
      </div>

      <div className=''>
        <span className='bg-neutral-300 text-xs text-gray-600 rounded-full py-1 px-2 mr-2'>
          #133
        </span>
        <span className='font-bold'>{room.name}</span>
      </div>
    </div>
  );
};

export default RoomCard;
