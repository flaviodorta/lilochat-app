'use client';

import CreateRoomButton from '../create-room-buttom';
import SearchRoom from '../search-room';
import LoginButton from './login-button';
import { useDisclosure } from '@chakra-ui/react';
import AuthModal from '../login-modal';
import { Luckiest_Guy } from 'next/font/google';

const luckiestGuy = Luckiest_Guy({ subsets: ['latin'], weight: ['400'] });

const Header = () => {
  const { isOpen, onOpen, onClose } = useDisclosure();

  return (
    <>
      <div className='px-2 md:px-4 xl:px-48 w-full flex justify-between items-center h-24'>
        <div className='hidden md:block mx-4'>
          <span
            className={`text-4xl luckiest-guy-regular text-purple-700 ${luckiestGuy.className}`}
          >
            lilochat
          </span>
        </div>

        <div className='flex-1 items-center justify-center flex gap-8 mx-4'>
          <SearchRoom />

          <div className='hidden md:block'>
            <CreateRoomButton />
          </div>
        </div>

        <div className='mx-4'>
          <LoginButton onClick={onOpen} />
        </div>
      </div>

      <AuthModal isOpen={isOpen} onClose={onClose} />
    </>
  );
};

export default Header;
