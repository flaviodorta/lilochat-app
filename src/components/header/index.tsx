'use client';

import CreateRoomButton from '../create-room-buttom';
import SearchRoom from '../search-room';
import LoginButton from './login-button';
import { useDisclosure } from '@chakra-ui/react';
import AuthModal from '../login-modal';
import { Luckiest_Guy } from 'next/font/google';
// import { useAuth } from '@/context/auth-context';
import { useEffect } from 'react';
import { BiUser } from 'react-icons/bi';
import { FaUserCircle } from 'react-icons/fa';
import ProfileButton from './profile-button';
import CreateRoomModal from '../create-room-modal';
import { useMountEffect } from '@/hooks/use-mount-effect';
import { getUserData } from '@/actions/user/get-user-data';
import { User } from '@/types/user';

const luckiestGuy = Luckiest_Guy({ subsets: ['latin'], weight: ['400'] });

type Props = {
  user: User | null;
};

const Header = ({ user }: Props) => {
  const isMount = useMountEffect();

  const {
    isOpen: isOpenAuth,
    onClose: onCloseAuth,
    onOpen: onOpenAuth,
  } = useDisclosure();
  const {
    isOpen: isOpenCreateRoom,
    onClose: onCloseCreateRoom,
    onOpen: onOpenCreateRoom,
  } = useDisclosure();
  // const { isAuthenticated, setIsAuthenticated } = useAuth();

  // useEffect(() => {
  //   if (isAuthenticated) onCloseAuth();
  // }, [isAuthenticated]);

  if (!isMount) return null;

  return (
    <>
      <div className='fixed top-0 bg-gray-50 z-10 left-0 px-2 md:px-4 xl:px-48 w-full flex justify-between items-center h-24'>
        <div className='hidden md:block mx-4'>
          <div
            className={`text-4xl inline-block luckiest-guy-regular text-purple-700 ${luckiestGuy.className}`}
          >
            lilochat
          </div>
        </div>

        <div className='flex-1 items-center justify-center flex gap-8 mx-4'>
          <SearchRoom />

          <div className='hidden md:block'>
            <CreateRoomButton user={user} onOpen={onOpenCreateRoom} />
          </div>
        </div>

        <div className='mx-4 flex items-center'>
          {!user ? (
            <LoginButton onClick={() => onOpenAuth()} />
          ) : (
            <ProfileButton nickname={user?.nickname} />
          )}
        </div>
      </div>

      <AuthModal isOpen={isOpenAuth} onClose={onCloseAuth} />
      <CreateRoomModal
        user={user}
        isOpen={isOpenCreateRoom}
        onClose={onCloseCreateRoom}
      />
    </>
  );
};

export default Header;
