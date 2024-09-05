'use client';

import CreateRoomButton from '../create-room-buttom';
import SearchRoom from '../search-room';
import LoginButton from './login-button';
import { useDisclosure } from '@chakra-ui/react';
import AuthModal from '../login-modal';
import { Luckiest_Guy } from 'next/font/google';
import useModalAuthStore from '@/zustand/modal-auth-store';
import { useAuth } from '@/context/auth-context';
import { useEffect } from 'react';
import { BiUser } from 'react-icons/bi';
import { FaUserCircle } from 'react-icons/fa';
import ProfileButton from './profile-button';
import CreateRoomModal from '../create-room-modal';
import useModalCreateRoomStore from '@/zustand/modal-create-room-store';

const luckiestGuy = Luckiest_Guy({ subsets: ['latin'], weight: ['400'] });

const Header = () => {
  const {
    isOpen: isOpenAuth,
    onClose: onCloseAuth,
    onOpen: onOpenAuth,
  } = useModalAuthStore();
  const {
    isOpen: isOpenCreateRoom,
    onClose: onCloseCreateRoom,
    onOpen: onOpenCreateRoom,
  } = useModalCreateRoomStore();
  const { isAuthenticated, user, setIsAuthenticated } = useAuth();

  useEffect(() => {
    if (isAuthenticated) onCloseAuth();
  }, [isAuthenticated]);

  console.log('is auth', isAuthenticated);

  const deauthenticated = () => setIsAuthenticated(false);

  return (
    <>
      <div className='fixed top-0 left-0 px-2 md:px-4 xl:px-48 w-full flex justify-between items-center h-24'>
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
            <CreateRoomButton onOpen={onOpenCreateRoom} />
          </div>
        </div>

        <div className='mx-4 flex items-center'>
          {!isAuthenticated ? (
            <LoginButton
              onClick={() => {
                onOpenAuth();
                console.log('click login');
              }}
            />
          ) : (
            <ProfileButton
              email={user?.email!}
              deauthenticated={deauthenticated}
            />
          )}
        </div>
      </div>

      <AuthModal isOpen={isOpenAuth} onClose={onCloseAuth} />
      <CreateRoomModal isOpen={isOpenCreateRoom} onClose={onCloseCreateRoom} />
    </>
  );
};

export default Header;
