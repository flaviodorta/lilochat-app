'use server';

import supabaseServerClient from '@/supabase/supabase-server';
// import { revalidatePath } from 'next/cache';
// import { redirect } from 'next/navigation';

const signUpWithEmail = async ({
  email,
  password,
}: {
  email: string;
  password: string;
}) => {
  const supabase = supabaseServerClient();

  const { error, data } = await supabase.auth.signUp({
    email,
    password,
  });

  if (error) {
    console.log('ERROR SIGNUP', error);
  }

  if (data) {
    console.log('USER CREATED', data);
  }

  // revalidatePath('/', 'layout');
  // redirect('/');

  return { data: JSON.stringify(data) };
};

export default signUpWithEmail;
