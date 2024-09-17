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
import { cn } from '@/utils/cn';

type Props = {
  room: Room;
  user: User;
};

const RoomTabs = ({ room, user }: Props) => {
  const { channel } = useChannel();
  const { users, kingRoomId, videoUrl, setVideoUrl } = useRoomStore(
    (state) => state
  );
  const [videos, setVideos] = useState<Video[]>([]);
  const { isOpen, onClose, onOpen } = useDisclosure();

  const isKingRoom = user.id === kingRoomId;

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
          setVideos((prevVideos) => [...prevVideos, payload.new]);
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(videosListener);
    };
  }, []);

  const handleChangeVideo = async (
    videoUrl: string,
    videoThumbnailUrl: string
  ) => {
    if (!isKingRoom) return;
    setVideoUrl(videoUrl);

    channel?.send({
      type: 'broadcast',
      event: 'change-video',
      payload: {
        videoUrl,
      },
    });

    const { error } = await supabase
      .from('rooms')
      .update({
        video_url: videoUrl,
        video_thumbnail_url: videoThumbnailUrl,
      })
      .eq('id', room.id);

    if (error) {
      console.log('Error at update video url');
    }
  };

  return (
    <>
      <div className='hidden lg:flex h-fit w-full lg:h-full flex-col pt-4 pb-4 bg-gray-100'>
        <Tabs
          colorScheme='purple'
          className='h-full overflow-y-auto scrollbar-thin w-full rounded-lg bg-neutral-50 flex flex-col'
          variant='enclosed'
        >
          <TabList className='sticky top-0 bg-white z-10'>
            <Tab>Videos</Tab>
            <Tab>Strangers</Tab>
          </TabList>
          <TabPanels className='w-full flex-grow'>
            <TabPanel className='flex-grow w-full'>
              <ul className='w-full max-h-full flex-grow flex-col overflow-y-auto items-start flex gap-2'>
                {videos.map((video) => (
                  <div
                    key={video.id}
                    className={cn([
                      'flex gap-4 items-center w-full py-2',
                      isKingRoom && 'cursor-pointer',
                      videoUrl === video.video_url && 'bg-gray-200',
                    ])}
                    onDoubleClick={() =>
                      handleChangeVideo(video.video_url, video.thumbnail_url)
                    }
                  >
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
              <ul className='w-full h-[330px] flex-col overflow-y-auto scrollbar-thin flex gap-4'>
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
