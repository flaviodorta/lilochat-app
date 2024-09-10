import { redirect, useRouter } from 'next/navigation';
import Messages from './messages';
import { useEffect, useState } from 'react';
import supabaseCreateClient from '@/utils/supabase/supabase-client';
import { Session, AuthChangeEvent } from '@supabase/supabase-js';
import { getUserData } from '@/actions/user/get-user-data';

const RoomPage = async ({
  params,
}: {
  params: {
    id: string;
  };
}) => {
  const user = await getUserData();

  if (!user) redirect('/');

  return (
    <div className='flex flex-col w-full'>
      <div className='h-screen flex flex-col'>
        <h1 className='w-full h-6 bg-gray-100 p-4 flex items-center'>
          Room 2 {params.id}
        </h1>
        <div className='h-full flex flex-col lg:flex-row'>
          <div className='w-full h-full lg:w-1/2'>
            <div className='h-full lg:h-1/2 bg-red-500'></div>
            <div className='h-0 lg:h-1/2 bg-blue-500'></div>
          </div>
          <div className='h-full w-full lg:w-1/2 lg:h-full'>
            <Messages roomId={params.id} userId={user.id} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default RoomPage;
