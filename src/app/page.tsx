import { getUserData } from '@/actions/user/get-user-data';
import Home from '@/components/home';
import Image from 'next/image';

export default async function HomePage() {
  const user = await getUserData();

  if (user) {
    console.log('user data', user);
  } else {
    console.log('NO USER PAGE HEADER');
  }

  return (
    <main className='bg-neutral-50 w-full container mx-auto min-h-[calc(100vh-160px)]'>
      <Home user={user} />
    </main>
  );
}
