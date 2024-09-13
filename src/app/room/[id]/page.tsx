import { redirect, useRouter } from 'next/navigation';
import Messages from './messages';
import { useEffect, useState } from 'react';
import supabaseCreateClient from '@/utils/supabase/supabase-client';
import { Session, AuthChangeEvent } from '@supabase/supabase-js';
import { getUserData } from '@/actions/user/get-user-data';
import RoomPlayer from './player';
import { getRoomData } from '@/actions/rooms/get-room-data';

const RoomPage = async ({
  params,
}: {
  params: {
    id: string;
  };
}) => {
  const user = await getUserData();

  if (!user) redirect('/');

  const room = await getRoomData(params.id);

  if (!room) redirect('/');

  return (
    <div className='flex flex-col w-full h-screen'>
      <div className='h-full flex flex-col'>
        <h1 className='w-full text-lg font-bold h-6 bg-gray-100 p-4 flex items-center'>
          Room - {room.name}
        </h1>
        <div className='h-[calc(100vh-40px)] flex flex-col lg:flex-row'>
          <div className='w-full h-full lg:w-1/2'>
            <div className='h-full lg:h-1/2 bg-red-500'>
              <RoomPlayer room={room} userId={params.id} />
            </div>
            <div className='h-0 lg:h-1/2 bg-blue-500'></div>
          </div>
          <div className='h-1/2 lg:w-1/2 lg:h-full'>
            <Messages room={room} userId={user.id} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default RoomPage;
