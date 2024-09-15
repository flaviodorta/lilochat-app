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
import { useEffect, useState } from 'react';
import ToastError from './toast-error';
// import supabaseCreateClient from '@/utils/supabase/supabase-client';
import { addVideoToRoom } from '@/actions/videos/add-video-to-room';
import { getVideoData } from '@/actions/videos/get-video-data';
import { createRoom } from '@/actions/rooms/create-room';
import axios from 'axios';
import { User } from '@/types/user';
import { Room } from '@/types/rooms';
import supabaseCreateClient from '@/utils/supabase/supabase-client';

const AddVideoModal = ({
  isOpen,
  onClose,
  user,
  room,
}: {
  isOpen: boolean;
  onClose: () => void;
  user: User;
  room: Room;
}) => {
  const [videoUrl, setVideoUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const toast = useToast();
  const supabase = supabaseCreateClient();

  const handleAddVideo = async () => {
    if (!videoUrl) {
      return toast({
        title: 'Input a youtube video url',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    }

    setIsLoading(true);

    try {
      const { data: existVideo, error: existVideoError } = await supabase
        .from('videos')
        .select('id')
        .eq('video_url', videoUrl.trim())
        .eq('room_id', room.id)
        .single();

      if (existVideoError && existVideoError.code !== 'PGRST116') {
        throw existVideoError;
      }

      if (existVideo) {
        setVideoUrl('');
        return toast({
          title: 'This video has already been added to this room.',
          status: 'warning',
          duration: 5000,
          isClosable: true,
        });
      }

      const response = await axios.post('/api/videos', {
        videoUrl: videoUrl.trim(),
        roomId: room.id,
        userId: user.id,
      });

      if (response.status === 200) {
        toast({
          title: 'Video added successfully!',
          status: 'success',
          duration: 5000,
          isClosable: true,
        });
      }

      setVideoUrl('');
      onClose();
    } catch (error) {
      console.error('Error adding video.', error);
      toast({
        title: 'Error adding video.',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    setVideoUrl('');

    return () => {
      setVideoUrl('');
    };
  }, []);

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <ModalOverlay />
      <ModalContent className='min-w-[300px] pb-6'>
        <ModalHeader className='text-center'>Add more videos</ModalHeader>
        <ModalBody className='pb-6'>
          <div className='flex flex-col gap-6'>
            <div className=''>
              <Text className='font-bold'>Youtube video link</Text>
              <Input
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
              ></Input>
            </div>
            <button
              onClick={handleAddVideo}
              disabled={isLoading}
              className='button text-white w-full'
            >
              {isLoading ? 'Adding a video...' : 'Add a video'}
            </button>
          </div>
        </ModalBody>
      </ModalContent>
    </Modal>
  );
};

export default AddVideoModal;
