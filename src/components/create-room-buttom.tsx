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
      className='button hover:shadow-lg py-2.5 px-4 text-white hover:-translate-y-[2px] transition-all durantion-100'
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
