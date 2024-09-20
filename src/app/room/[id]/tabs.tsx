'use client';

import {
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
  useDisclosure,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
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
import { RxVideo } from 'react-icons/rx';
import { FaUser } from 'react-icons/fa6';
import { RiVipCrown2Fill } from 'react-icons/ri';

type Props = {
  room: Room;
  user: User;
};

const RoomTabs = ({ room, user }: Props) => {
  const { channel } = useChannel();
  const {
    users,
    kingRoomId,
    videoUrl,
    videos,
    setVideos,
    addVideo,
    setVideoUrl,
  } = useRoomStore((state) => state);
  // const [videos, setVideos] = useState<Video[]>([]);
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
          addVideo(payload.new);
          // setVideos((prevVideos) => [...prevVideos, payload.new]);
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

  const {
    isOpen: isVideosOpen,
    onOpen: onVideosOpen,
    onClose: onVideosClose,
  } = useDisclosure();

  const {
    isOpen: isStrangersOpen,
    onOpen: onStrangersOpen,
    onClose: onStrangersClose,
  } = useDisclosure();

  const videoList = (
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
      <button onClick={onOpen} className='hover:text-purple-600 font-bold'>
        + Add more videos
      </button>
    </ul>
  );

  const strangersList = (
    <ul className='w-full h-[330px] flex-col overflow-y-auto scrollbar-thin flex gap-4'>
      {users.map((user, idx) => (
        <div key={idx} className='flex gap-4 items-center'>
          <Image
            src={`https://api.multiavatar.com/${user.nickname}.png?apikey=${process.env.NEXT_PUBLIC_YOUTUBE_API_KEY}`}
            width={24}
            height={24}
            alt='Avatar'
          />
          <div className='flex gap-2 items-center'>
            {user.nickname}

            {user.user_id === kingRoomId && (
              <span className='text-yellow-500 mr-auto -translate-y-[1px]'>
                <RiVipCrown2Fill />
              </span>
            )}
          </div>
        </div>
      ))}
    </ul>
  );

  return (
    <>
      <div className='pl-4 bg-white h-10 flex gap-4 lg:hidden'>
        <button
          onClick={onVideosOpen}
          className={cn([
            'flex gap-2 items-center hover:text-purple-600',
            isVideosOpen && 'text-purple-600',
          ])}
        >
          <RxVideo />
          <span>Videos</span>
        </button>
        <button
          onClick={onStrangersOpen}
          className={cn([
            'flex gap-2 items-center hover:text-purple-600',
            isStrangersOpen && 'text-purple-600',
          ])}
        >
          <FaUser />
          <span>Strangers</span>
        </button>

        <Modal isOpen={isVideosOpen} onClose={onVideosClose}>
          <ModalOverlay />
          <ModalContent className='min-w-[300px] overflow-hidden max-h-[600px] pb-6'>
            <ModalHeader className='text-center sticky top-0 bg-white'>
              <div className='flex justify-center gap-2 items-center'>
                <RxVideo />
                <span>Videos</span>
              </div>
            </ModalHeader>
            <ModalBody className='pb-6 overflow-y-auto scrollbar-thin'>
              {videoList}
            </ModalBody>
          </ModalContent>
        </Modal>

        <Modal isOpen={isStrangersOpen} onClose={onStrangersClose}>
          <ModalOverlay />
          <ModalContent className='min-w-[300px] overflow-hidden max-h-[600px] pb-6'>
            <ModalHeader className='text-center sticky top-0 bg-white'>
              <div className='flex justify-center gap-2 items-center'>
                <FaUser />
                <span>Strangers</span>
              </div>
            </ModalHeader>
            <ModalBody className='pb-6 overflow-y-auto scrollbar-thin'>
              {strangersList}
            </ModalBody>
          </ModalContent>
        </Modal>
      </div>

      <div className='hidden lg:flex h-fit w-full lg:h-full flex-col pt-4 pb-4 bg-gray-100'>
        <Tabs
          colorScheme='purple'
          className='h-full overflow-y-auto scrollbar-thin w-full rounded-lg bg-neutral-50 flex flex-col'
          variant='enclosed'
        >
          <TabList className='sticky top-0 bg-white z-10'>
            <Tab>
              <div className='flex gap-2 items-center'>
                <RxVideo />
                <span>Videos</span>
              </div>
            </Tab>
            <Tab>
              <div className='flex gap-2 items-center'>
                <FaUser />
                <span>Strangers</span>
              </div>
            </Tab>
          </TabList>
          <TabPanels className='w-full flex-grow h-0'>
            <TabPanel className='flex-grow w-full'>{videoList}</TabPanel>

            <TabPanel className='h-full w-full'>{strangersList}</TabPanel>
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
