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
import Image from 'next/image';

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

  if (!isMount) return null;

  return (
    <>
      <div className='fixed px-8 md:px-0 top-0 w-full container mx-auto bg-gray-50 z-10 left-1/2 -translate-x-1/2 flex justify-between items-center h-24'>
        <div className='hidden md:block'>
          <div
            className={`translate-y-2 text-4xl flex gap-2 luckiest-guy-regular text-purple-600 ${luckiestGuy.className}`}
          >
            <Image
              src='/lilochat-logo.svg'
              width={60}
              height={30}
              className='fill-slate-500 text-purple-600'
              color='#A020F0'
              alt='Lilochat logo'
            />
            lilochat
          </div>
        </div>

        <div className='md:mx-4 flex-1 items-center justify-center flex gap-8'>
          <SearchRoom />

          <div className=''>
            <CreateRoomButton user={user} onOpen={onOpenCreateRoom} />
          </div>
        </div>

        <div className='ml-4 flex items-center justify-between'>
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
