'use server';

import supabaseServerClient from '@/utils/supabase/supabase-server';
// import { revalidatePath } from 'next/cache';
// import { redirect } from 'next/navigation';

const signInWithEmail = async ({
  email,
  password,
}: {
  email: string;
  password: string;
}) => {
  const supabase = supabaseServerClient();

  const { error, data } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    console.log('ERROR SIGNIN', error);
  }

  if (data.session) {
    console.log('sign in data', data);
  }

  // revalidatePath('/', 'layout');
  // redirect('/');
  // console.log(data);

  return { data: JSON.stringify(data), error: JSON.stringify(error) };
};

export default signInWithEmail;
