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
    <div className='flex flex-col'>
      <div className='grid h-screen grid-cols-1 md:grid-cols-2'>
        <h1 className='col-span-12 h-6 bg-gray-100'>Room 2 {params.id}</h1>
        <div className='w-full h-1/2 bg-red-500'>dsa</div>
        <div className='h-[calc(50vh)] md:h-[calc(100vh-24px)]'>
          <Messages roomId={params.id} userId={user.id} />
        </div>
      </div>
    </div>
  );
};

export default RoomPage;
