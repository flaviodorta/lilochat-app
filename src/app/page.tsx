import { getUserData } from '@/actions/user/get-user-data';
import Header from '@/components/header';
import Image from 'next/image';

export default async function Home() {
  const user = await getUserData();

  if (user) {
    console.log('user data', user);
  } else {
    console.log('NO USER PAGE HEADER');
  }

  return (
    <main className='flex min-h-screen flex-col items-center justify-between'>
      <Header user={user} />
    </main>
  );
}
