'use client';

import { Tabs, TabList, TabPanels, Tab, TabPanel } from '@chakra-ui/react';
import supabaseCreateClient from '@/utils/supabase/supabase-client';
import { Room } from '@/types/rooms';
import { useEffect, useState } from 'react';
import { Video } from '@/types/video';
import { getVideoData } from '@/actions/videos/get-video-data';
import Image from 'next/image';
import { User } from '@/types/user';

type Props = {
  room: Room;
};

const RoomTabs = ({ room }: Props) => {
  const [videos, setVideos] = useState<Video[]>([]);
  const [users, setUsers] = useState<User[]>([]);

  const supabase = supabaseCreateClient();

  const getVideos = async () => {
    const { data, error } = await supabase.from('videos').select('*');
    // .eq('room_id', room.id);

    if (error) {
      console.log('Error ao buscar videos', error);
    } else {
      setVideos(data);
    }
  };

  const getUsers = async () => {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('room_id', room.id);
    // .eq('room_id', room.id);

    if (error) {
      console.log('Error ao buscar videos', error);
    } else {
      setUsers(data);
    }
  };

  useEffect(() => {
    console.log('videos', videos);
    console.log('users', users);
  }, [videos, users]);

  useEffect(() => {
    getVideos();
    getUsers();
  }, []);

  return (
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
            <ul className='w-full flex-col overflow-y-auto items-start scrollbar-thin flex gap-4'>
              {videos.map((video) => (
                <div key={video.id} className='flex gap-4 items-center jus'>
                  <Image
                    width={40}
                    height={26}
                    alt='video'
                    src={video.thumbnail_url}
                  ></Image>
                  <p>{video.title}</p>
                </div>
              ))}
              <button className='hover:text-purple-600'>
                + Add more videos
              </button>
            </ul>
          </TabPanel>
          <TabPanel className='h-full w-full'>
            <ul className='w-full flex-col overflow-y-auto scrollbar-thin flex gap-4'>
              {users.map((user) => (
                <div key={user.id} className='flex gap-4 items-center'>
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
    </div>
  );
};

export default RoomTabs;
