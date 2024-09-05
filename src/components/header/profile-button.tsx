'use client';

import signOut from '@/actions/auth/signout';
import { Menu, MenuButton, MenuItem, MenuList } from '@chakra-ui/react';
import { BiLogOut, BiUser } from 'react-icons/bi';
import { FaUserCircle } from 'react-icons/fa';

const ProfileButton = ({
  email,
  deauthenticated,
}: {
  email: string;
  deauthenticated: () => void;
}) => {
  return (
    <Menu>
      <MenuButton>
        <div className='flex space-x-3'>
          <span className='hidden md:block text-lg text-purple-600 font-bold'>
            Hi, {email?.split('@')[0]}
          </span>
          <FaUserCircle className='text-purple-600 w-6 h-6' />
        </div>
      </MenuButton>
      <MenuList>
        <MenuItem icon={<BiUser />}>Profile</MenuItem>
        <MenuItem
          onClick={() => {
            signOut();
            deauthenticated();
          }}
          icon={<BiLogOut />}
        >
          Logout
        </MenuItem>
      </MenuList>
    </Menu>
  );
};

export default ProfileButton;
