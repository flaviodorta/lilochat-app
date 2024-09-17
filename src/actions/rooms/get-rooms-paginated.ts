import supabaseServerClient from '@/utils/supabase/supabase-server';

const PAGE_SIZE = 10;

export const getRoomsPaginated = async (pageParam = 0) => {
  const start = pageParam * PAGE_SIZE;
  const end = start + PAGE_SIZE - 1;

  const supabase = supabaseServerClient();

  const { data, error } = await supabase
    .from('rooms')
    .select(
      `
      id,
      name,
      video_url,
      video_thumbnail_url,
      video_time,
      video_is_playing  
    `
    )
    .range(start, end);

  // console.log(data);

  if (error) {
    console.log('error paginated videos', error);
    throw new Error(error.message);
  }

  if (!data) {
    console.log('nao ha salas');
    throw new Error('Not exist rooms');
  }

  const nextCursor = data.length < PAGE_SIZE ? undefined : pageParam + 1;

  return { data, nextCursor };
};
