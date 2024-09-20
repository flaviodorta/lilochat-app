'use client';

import CreateRoomButton from '../create-room-buttom';
import SearchRoom from '../search-room';
import LoginButton from './login-button';
import { useDisclosure } from '@chakra-ui/react';
import AuthModal from '../login-modal';
import { Luckiest_Guy } from 'next/font/google';
// import { useAuth } from '@/context/auth-context';
import { useEffect, useState } from 'react';
import { BiUser } from 'react-icons/bi';
import { FaUserCircle } from 'react-icons/fa';
import UserButton from './profile-button';
import CreateRoomModal from '../create-room-modal';
import { useMountEffect } from '@/hooks/use-mount-effect';
import { getUserData } from '@/actions/user/get-user-data';
import { User } from '@/types/user';
import Image from 'next/image';
import ProfileModal from '../profile-modal';
import supabaseCreateClient from '@/utils/supabase/supabase-client';

const luckiestGuy = Luckiest_Guy({ subsets: ['latin'], weight: ['400'] });

type Props = {
  user: User | null;
  setSearchKeyword: React.Dispatch<React.SetStateAction<string>>;
};

const Header = ({ user, setSearchKeyword }: Props) => {
  const isMount = useMountEffect();

  const [nickname, setNickname] = useState(user?.nickname);

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
  const {
    isOpen: isOpenProfile,
    onClose: onCloseProfile,
    onOpen: onOpenProfile,
  } = useDisclosure();

  const supabase = supabaseCreateClient();

  useEffect(() => {
    if (!user) return;

    const avatarUpdateListener = supabase
      .channel(`avatar-udpate-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'users',
          filter: `id=eq.${user.id}`,
        },
        (payload: any) => {
          setNickname(payload.new.nickname);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(avatarUpdateListener);
    };
  }, []);

  if (!isMount) return null;

  return (
    <>
      <div className='fixed px-8 md:px-0 top-0 w-full container mx-auto bg-gray-50 z-10 left-1/2 -translate-x-1/2 flex justify-between items-center h-24'>
        <div className='hidden md:block'>
          <div
            className={`translate-y-2 text-4xl flex gap-3 luckiest-guy-regular text-purple-600 ${luckiestGuy.className}`}
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
          <SearchRoom setSearchKeyword={setSearchKeyword} />

          <div className=''>
            <CreateRoomButton user={user} onOpen={onOpenCreateRoom} />
          </div>
        </div>

        <div className='ml-4 flex items-center justify-between'>
          {!user ? (
            <LoginButton onClick={() => onOpenAuth()} />
          ) : (
            <UserButton
              onClickProfile={() => onOpenProfile()}
              nickname={nickname}
            />
          )}
        </div>
      </div>

      <AuthModal isOpen={isOpenAuth} onClose={onCloseAuth} />
      <CreateRoomModal
        user={user}
        isOpen={isOpenCreateRoom}
        onClose={onCloseCreateRoom}
      />
      {user && (
        <ProfileModal
          isOpen={isOpenProfile}
          onClose={onCloseProfile}
          user={user}
        />
      )}
    </>
  );
};

export default Header;
