'use server';

import supabaseServerClient from '@/utils/supabase/supabase-server';
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

  const { data: signUpData, error: signInError } = await supabase.auth.signUp({
    email,
    password,
  });

  if (signInError) {
    throw new Error(signInError.message);
    console.log('ERROR SIGNUP', signInError);
  }

  let user;

  // criar uma server action para create user com essa logica
  if (signUpData) {
    console.log('here 1');
    console.log(signUpData);
    if (signUpData.user) {
      console.log('here 2');
      const userId = signUpData.user.id;
      console.log('user id', userId);

      const { data: existingUser, error: checkError } = await supabase
        .from('users')
        .select('id')
        .eq('id', userId)
        .single();

      if (checkError && checkError.code !== 'PGRST116') {
        console.log('ERROR CHECKING USER', checkError);
        throw new Error(checkError.message);
      }

      // Se o usuário não existir, inserir o novo usuário na tabela
      if (!existingUser) {
        const { data: insertData, error: insertError } = await supabase
          .from('users')
          .insert([
            {
              id: userId,
              email: email,
              created_at: new Date(),
              room_id: null,
              nickname: email.split('@')[0],
            },
          ])
          .select();

        console.log(insertData);

        if (insertError) {
          console.log('ERROR INSERTING USER', insertError);
          throw new Error(insertError.message);
        }

        if (insertData) {
          console.log('insert data', insertData);
          user = insertData;
        }
        // return { data: insertData };
      }

      console.log('User sign-in and insertion successful.');
    }
  }

  return user;

  // revalidatePath('/', 'layout');
  // redirect('/');
};

export default signUpWithEmail;
