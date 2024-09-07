'use client';

// import { useAuth } from '@/context/auth-context';
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
// import supabaseCreateClient from '@/utils/supabase/supabase-client';
import { addVideoToRoom } from '@/actions/videos/add-video-to-room';
import { getVideoData } from '@/actions/videos/get-video-data';
import { User } from '@/types/user';
import { createRoom } from '@/actions/rooms/create-room';

const CreateRoomModal = ({
  isOpen,
  onClose,
  user,
}: {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
}) => {
  const [roomName, setRoomName] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  // const { user } = useAuth();
  // const supabase = supabaseCreateClient();
  const toast = useToast();

  const handleCreateRoom = async () => {
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
      const response = await fetch('/api/rooms/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          roomName,
          videoUrl,
          userId: user.id,
        }),
      });

      const roomData = (await response.json()).data;

      if (roomData) {
        console.log(roomData.data);
      }

      onClose();
      router.push(`/room/${roomData.id}`);
    } catch (err) {
      console.log(err);
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
            onClick={handleCreateRoom}
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
