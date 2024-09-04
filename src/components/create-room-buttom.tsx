import { useAuth } from '@/context/auth-context';
import { Button, useToast } from '@chakra-ui/react';

const CreateRoomButton = ({ onOpen }: { onOpen: () => void }) => {
  const { isAuthenticated } = useAuth();
  const toast = useToast();

  return (
    <button
      className='button'
      onClick={
        isAuthenticated
          ? () => onOpen()
          : () =>
              toast({
                title: 'Create a account first!',
                status: 'error',
                duration: 5000,
                isClosable: true,
              })
      }
    >
      Create a room
    </button>
  );
};

export default CreateRoomButton;
