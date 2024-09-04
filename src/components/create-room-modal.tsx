'use client';

import { checkIfYouTubeVideoExists } from '@/actions/check-if-youtube-video-exists';
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

  const createRoom = async () => {
    if (!roomName || !videoUrl) {
      return ToastError('Input a room name and youtube video url');
    }

    setIsLoading(true);

    try {
      const res = await checkIfYouTubeVideoExists(videoUrl);
      console.log(res);
    } catch (err) {
      return ToastError('Youtube video url incorrect');
    }

    try {
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
      router.push(`/room/${roomData.id}`);
    } catch (err) {
      console.log(err);
      ToastError('Error at create room');
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
          <button onClick={createRoom} className='button w-full'>
            {isLoading ? 'Creating a room...' : 'Create a room'}
          </button>
        </ModalBody>
      </ModalContent>
    </Modal>
  );
};

export default CreateRoomModal;
