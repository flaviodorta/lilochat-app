import { getUserData } from '@/actions/user/get-user-data';
import Header from '@/components/header';
import RoomsList from '@/components/rooms-list';
import Image from 'next/image';

export default async function Home() {
  const user = await getUserData();

  if (user) {
    console.log('user data', user);
  } else {
    console.log('NO USER PAGE HEADER');
  }

  return (
    <main className='bg-neutral-50 w-full container mx-auto min-h-[calc(100vh-160px)]'>
      <Header user={user} />
      <RoomsList userId={user?.id} />
    </main>
  );
}
