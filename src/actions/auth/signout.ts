'use server';

import supabaseServerClient from '@/utils/supabase/supabase-server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

const signOut = async () => {
  const supabase = supabaseServerClient();

  await supabase.auth.signOut();

  revalidatePath('/', 'layout');
  redirect('/');
};

export default signOut;
