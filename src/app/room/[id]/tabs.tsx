'use client';

import {
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
  useDisclosure,
} from '@chakra-ui/react';
import supabaseCreateClient from '@/utils/supabase/supabase-client';
import { Room } from '@/types/rooms';
import { useEffect, useState } from 'react';
import { Video } from '@/types/video';
import { getVideoData } from '@/actions/videos/get-video-data';
import Image from 'next/image';
import { User } from '@/types/user';
import { useChannel } from '@/providers/channel-provider';
import { useRoomStore } from '@/providers/room-provider';
import AddVideoModal from '@/components/add-video-modal';

type Props = {
  room: Room;
  user: User;
};

const RoomTabs = ({ room, user }: Props) => {
  const { channel } = useChannel();
  const { users } = useRoomStore((state) => state);
  const [videos, setVideos] = useState<Video[]>([]);
  const { isOpen, onClose, onOpen } = useDisclosure();

  const supabase = supabaseCreateClient();

  const getVideos = async () => {
    const { data, error } = await supabase
      .from('videos')
      .select('*')
      .eq('room_id', room.id);

    if (error) {
      console.log('Error ao buscar videos', error);
    } else {
      setVideos(data);
    }
  };

  useEffect(() => {
    console.log('videos', videos);
  }, [videos, users]);

  useEffect(() => {
    getVideos();
  }, []);

  useEffect(() => {
    getVideos();

    const videosListener = supabase
      .channel(`videos-room-${room.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'videos',
          filter: `room_id=eq.${room.id}`,
        },
        (payload: any) => {
          console.log('video new', payload.new);
          setVideos((prevVideos) => [...prevVideos, payload.new]);
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(videosListener);
    };
  }, []);

  return (
    <>
      <div className='hidden lg:flex h-fit w-full lg:h-1/2 flex-col pt-4 pl-4 pb-4 bg-gray-100'>
        <Tabs
          colorScheme='purple'
          className='h-full w-full rounded-lg bg-neutral-50 flex flex-col'
          variant='enclosed'
        >
          <TabList>
            <Tab>Videos</Tab>
            <Tab>Users</Tab>
          </TabList>
          <TabPanels className='w-full flex-grow'>
            <TabPanel className='h-full w-full'>
              <ul className='w-full h-[300px] flex-col overflow-y-auto items-start scrollbar-thin flex gap-4'>
                {videos.map((video) => (
                  <div key={video.id} className='flex gap-4 items-center jus'>
                    <Image
                      width={40}
                      height={26}
                      alt='video'
                      src={video.thumbnail_url}
                    ></Image>
                    <p className='leading-5'>{video.title}</p>
                  </div>
                ))}
                <button
                  onClick={onOpen}
                  className='hover:text-purple-600 font-bold'
                >
                  + Add more videos
                </button>
              </ul>
            </TabPanel>

            <TabPanel className='h-full w-full'>
              <ul className='w-full h-[300px] flex-col overflow-y-auto scrollbar-thin flex gap-4'>
                {users.map((user, idx) => (
                  <div key={idx} className='flex gap-4 items-center'>
                    <Image
                      src={`https://api.multiavatar.com/${user.nickname}.png?apikey=${process.env.NEXT_PUBLIC_YOUTUBE_API_KEY}`}
                      width={24}
                      height={24}
                      alt='Avatar'
                    />
                    <p>{user.nickname}</p>
                  </div>
                ))}
              </ul>
            </TabPanel>
          </TabPanels>
        </Tabs>

        <AddVideoModal
          isOpen={isOpen}
          onClose={onClose}
          user={user}
          room={room}
        />
      </div>
    </>
  );
};

export default RoomTabs;
