// import { useAuth } from '@/context/auth-context';
import { User } from '@/types/user';
import { Button, useToast } from '@chakra-ui/react';

const CreateRoomButton = ({
  onOpen,
  user,
}: {
  onOpen: () => void;
  user: User | null;
}) => {
  const toast = useToast();

  return (
    <button
      className='button'
      onClick={
        user
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
