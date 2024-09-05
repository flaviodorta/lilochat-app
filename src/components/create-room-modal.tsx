'use client';

import { checkIfYouTubeVideoExists as checkIfVideoExists } from '@/actions/videos/check-if-video-exists';
import { useAuth } from '@/context/auth-context';
import {
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalHeader,
  ModalOverlay,
  Text,
  Toast,
  useToast,
} from '@chakra-ui/react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import ToastError from './toast-error';
import supabaseCreateClient from '@/supabase/supabase-client';
import { addVideoToRoom } from '@/actions/videos/add-video-to-room';
import { getVideoData } from '@/actions/videos/get-video-data';

const CreateRoomModal = ({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) => {
  const [roomName, setRoomName] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const { user } = useAuth();
  const supabase = supabaseCreateClient();
  const toast = useToast();

  const createRoom = async () => {
    if (!roomName || !videoUrl || !user) {
      return toast({
        title: 'Input a room name and youtube video url, and sign in',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    }

    setIsLoading(true);

    try {
      const res = await checkIfVideoExists(videoUrl);
      console.log(res);
    } catch (err) {
      return toast({
        title: 'Youtube video url incorrect',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    }

    try {
      // criar um server action para criação de sala
      const { data: roomData, error: roomError } = await supabase
        .from('rooms')
        .insert([
          {
            name: roomName,
            current_time: 0,
            is_playing: true,
          },
        ])
        .select()
        .single();

      if (roomError) {
        setIsLoading(false);
        setRoomName('');
        setVideoUrl('');
        throw roomError;
      }

      console.log(roomData);

      setRoomName('');
      setVideoUrl('');

      onClose();

      console.log('user', user);
      const videoData = await addVideoToRoom(videoUrl, roomData.id, user.id);
      console.log(videoData);

      router.push(`/room/${roomData.id}`);
    } catch (err) {
      // console.log(err);
      toast({
        title: 'Error at create room',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <ModalOverlay />
      <ModalContent className='min-w-[300px] pb-6'>
        <ModalHeader className='text-center'>Create Room</ModalHeader>
        <ModalBody className='pb-6'>
          <div className='flex flex-col gap-4'>
            <div className='mb-4'>
              <Text className='font-bold'>Room name</Text>
              <Input
                value={roomName}
                onChange={(e) => setRoomName(e.target.value)}
              ></Input>
            </div>

            <div className='mb-4'>
              <Text className='font-bold'>First Youtube video URL</Text>
              <Input
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
              ></Input>
            </div>
          </div>
          <button
            onClick={createRoom}
            disabled={isLoading}
            className='button w-full'
          >
            {isLoading ? 'Creating a room...' : 'Create a room'}
          </button>
        </ModalBody>
      </ModalContent>
    </Modal>
  );
};

export default CreateRoomModal;
