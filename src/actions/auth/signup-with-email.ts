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

  const { data: signUpData, error: signInError } = await supabase.auth.signUp({
    email,
    password,
  });

  if (signInError) {
    throw new Error(signInError.message);
    console.log('ERROR SIGNUP', signInError);
  }

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
            },
          ])
          .select();

        console.log(insertData);

        if (insertError) {
          console.log('ERROR INSERTING USER', insertError);
          throw new Error(insertError.message);
        }

        if (insertData) console.log('insert data', insertData);
        // return { data: insertData };
      }

      console.log('User sign-in and insertion successful.');
    }
  }

  // revalidatePath('/', 'layout');
  // redirect('/');
};

export default signUpWithEmail;
