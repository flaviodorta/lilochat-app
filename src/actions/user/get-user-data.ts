import supabaseServerClient from '@/utils/supabase/supabase-server';
import { NextApiRequest, NextApiResponse } from 'next';
import { User } from '@/types/user';

export const getUserData = async (): Promise<User | null> => {
  const supabase = await supabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    console.log('NO USER', user);
    return null;
  }

  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', user.id);

  if (error) {
    console.log('error at get user data', error);
    return null;
  }

  return data ? data[0] : null;
};
