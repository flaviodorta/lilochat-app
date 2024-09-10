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
    <main className='bg-neutral-50 mx-auto  lg:px-4 xl:px-36 min-h-screen'>
      <Header user={user} />
      <RoomsList userId={user?.id} />
    </main>
  );
}
