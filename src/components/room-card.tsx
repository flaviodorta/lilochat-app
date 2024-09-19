import { Room } from '@/types/rooms';
import supabaseCreateClient from '@/utils/supabase/supabase-client';
import { NumberInputProps, useToast } from '@chakra-ui/react';
import { createBrowserClient } from '@supabase/ssr';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { FaUser, FaUsers } from 'react-icons/fa6';
import { PiUsersThreeFill } from 'react-icons/pi';
import ReactPlayer from 'react-player';

type Props = {
  order: number;
  room: Room;
  userId?: string | undefined;
  lastRoomElementRef: ((node: HTMLDivElement | null) => void) | null;
};

const RoomCard = ({ order, room, userId, lastRoomElementRef }: Props) => {
  const [isHovered, setIsHovered] = useState(false);
  const [videoThumbnailUrl, setVideoThumbnailUrl] = useState(
    room.video_thumbnail_url
  );
  const router = useRouter();
  const toast = useToast();

  const supabase = supabaseCreateClient();

  const handleJoinRoom = async (roomId: string, userId?: string) => {
    if (!userId) {
      return toast({
        duration: 5000,
        title: 'Log in to account first',
        status: 'info',
      });
    }

    const { data: addUserToRoom, error: addUserToRoomError } = await supabase
      .from('users')
      .update({ room_id: roomId })
      .eq('id', userId);

    if (addUserToRoomError) {
      console.error('Erro ao atualizar o room_id:', addUserToRoomError);
    }
    // router.push('/room/' + roomId);
    router.push(`/room/${order}?id=${roomId}`);
  };

  useEffect(() => {
    const thumbnailCardListener = supabase
      .channel(`thumbnail-room-card-${room.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'rooms',
          filter: `id=eq.${room.id}`,
        },
        (payload: any) => {
          setVideoThumbnailUrl(payload.new.video_thumbnail_url);
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(thumbnailCardListener);
    };
  }, []);

  const [usersIds, setUsersIds] = useState<string[]>([]);

  const fetchUserCount = async () => {
    const { data: usersData, error: userCountError } = await supabase
      .from('users')
      .select('id')
      .eq('room_id', room.id);

    if (userCountError) {
      console.log('Error to count users', userCountError);
      return;
    }
    setUsersIds([...usersData.map((user) => user.id)]);
  };

  useEffect(() => {
    const usersCountLister = supabase
      .channel(`room-user-count-${room.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'users',
          filter: `room_id=eq.${room.id}`,
        },
        () => {
          fetchUserCount();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(usersCountLister);
    };
  }, []);

  return (
    <div
      ref={lastRoomElementRef}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={() => handleJoinRoom(room.id, userId)}
      className='group mx-auto cursor-pointer relative mb-8 hover:cursor-pointer w-full flex flex-col gap-4'
    >
      <div className='room-card w-full relative overflow-hidden  group-hover:-translate-x-[6px] group-hover:-translate-y-[6px] group-hover:shadow-[2px_2px_0px_0px,_3px_3px_0px_0px,_4px_4px_0px_0px,_5px_5px_0px_0px,_6px_6px_0px_0px]'>
        <Image
          alt='image'
          width={300}
          height={200}
          src={videoThumbnailUrl}
          className='border-l border-l-purple-600 w-full'
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

          <span className='font-bold'>{usersIds.length}</span>
        </div>
      </div>

      <div className=''>
        <span className='bg-purple-200 text-xs text-purple-600 rounded-full py-1 px-2 mr-2'>
          #{order}
        </span>
        <span className='font-bold'>{room.name}</span>
      </div>
    </div>
  );
};

export default RoomCard;
