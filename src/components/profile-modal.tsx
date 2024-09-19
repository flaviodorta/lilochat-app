import React, { useEffect, useState } from 'react';
import {
  Button,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  Input,
  Spinner,
} from '@chakra-ui/react';
import UserAvatar from './user-avatar';
import supabaseCreateClient from '@/utils/supabase/supabase-client';
import { User } from '@/types/user';
import { Span } from 'next/dist/trace';
import { useRouter } from 'next/navigation';

const ProfileModal = ({
  isOpen,
  onClose,
  user,
}: {
  isOpen: boolean;
  onClose: () => void;
  user: User;
}) => {
  const [nicknameInput, setNicknameInput] = useState(user.nickname);
  const supabase = supabaseCreateClient();
  const [isSaving, setIsSaving] = useState(false);
  const router = useRouter();

  const handleSaveNickname = async () => {
    setIsSaving(true);
    const { error } = await supabase
      .from('users')
      .update({ nickname: nicknameInput })
      .eq('id', user.id);
    setIsSaving(false);
    router;
    onClose();
    if (error) {
      console.error('Errot at udpate nickname', error);
    } else {
      router.refresh();
    }
  };

  useEffect(() => {
    setNicknameInput(user.nickname);
  }, []);

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={() => {
          setNicknameInput(user.nickname);
          onClose();
        }}
      >
        <ModalOverlay />
        <ModalContent>
          <ModalHeader className='text-center'>Profile</ModalHeader>
          <ModalCloseButton />

          <ModalBody className='flex items-center gap-10'>
            <UserAvatar nickname={nicknameInput} width={120} height={120} />
            <Input
              value={nicknameInput}
              onChange={(e) => setNicknameInput(e.target.value)}
              placeholder='Basic usage'
            />
          </ModalBody>

          <ModalFooter className='flex gap-4'>
            <button onClick={handleSaveNickname} className='button'>
              {isSaving ? (
                <div className='flex gap-2'>
                  <Spinner color='white' size='xs' />
                  Saving...
                </div>
              ) : (
                <span>Save</span>
              )}
            </button>
            <Button className='text-purple-600' onClick={onClose}>
              Close
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
};

export default ProfileModal;
