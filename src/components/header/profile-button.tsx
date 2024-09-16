'use client';

import signOut from '@/actions/auth/signout';
import { Menu, MenuButton, MenuItem, MenuList } from '@chakra-ui/react';
import { BiLogOut, BiUser } from 'react-icons/bi';
import UserAvatar from '../user-avatar';

const ProfileButton = ({ nickname }: { nickname: string }) => {
  return (
    <Menu>
      <MenuButton>
        <div className='flex space-x-3 items-center'>
          <span className='hidden md:block text-lg text-purple-600 font-bold'>
            Hi, {nickname}
          </span>
          <UserAvatar width={30} height={30} nickname={nickname} />
        </div>
      </MenuButton>
      <MenuList>
        <MenuItem icon={<BiUser />}>Profile</MenuItem>
        <MenuItem onClick={() => signOut()} icon={<BiLogOut />}>
          Logout
        </MenuItem>
      </MenuList>
    </Menu>
  );
};

export default ProfileButton;
