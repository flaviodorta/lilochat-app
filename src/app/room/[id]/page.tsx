import { redirect, useRouter } from 'next/navigation';
import Messages from './messages';
import { useEffect, useState } from 'react';
import supabaseCreateClient from '@/utils/supabase/supabase-client';
import { Session, AuthChangeEvent } from '@supabase/supabase-js';
import { getUserData } from '@/actions/user/get-user-data';
import Player from './player';
import { getRoomData } from '@/actions/rooms/get-room-data';
import { RoomStoreProvider } from '@/providers/room-provider';
import { ChannelProvider } from '@/providers/channel-provider';
import RoomTabs from './tabs';
import supabaseServerClient from '@/utils/supabase/supabase-server';

const RoomPage = async ({
  params,
  searchParams,
}: {
  params: {
    id: number;
  };
  searchParams: {
    id: string;
  };
}) => {
  console.log('params', searchParams);
  const user = await getUserData();

  if (!user) redirect('/');

  const room = await getRoomData(searchParams.id);

  if (!room) redirect('/');

  const supabase = supabaseServerClient();

  // await supabase.from('users').update({ room_id: room.id }).eq('id', user.id);

  return (
    <RoomStoreProvider>
      <ChannelProvider room={room} user={user}>
        <div className='flex flex-col w-full h-screen bg-gray-100'>
          <div className='h-full flex flex-col'>
            <h1 className='w-full text-lg font-bold h-6 bg-gray-100 p-4 flex items-center'>
              Room {params.id} - {room.name}
            </h1>
            <div className='h-[calc(100vh-40px)] flex flex-col lg:flex-row'>
              <div className='w-full h-full lg:w-1/2'>
                <div className='h-[calc(100%-40px)] lg:h-1/2'>
                  <Player room={room} user={user} />
                </div>
                <div className='h-10 lg:h-1/2'>
                  <RoomTabs room={room} user={user}></RoomTabs>
                </div>
              </div>
              <div className='h-1/2 lg:w-1/2 lg:h-full'>
                <Messages room={room} user={user} />
              </div>
            </div>
          </div>
        </div>
      </ChannelProvider>
    </RoomStoreProvider>
  );
};

export default RoomPage;
