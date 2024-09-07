import supabaseServerClient from '@/utils/supabase/supabase-server';

const PAGE_SIZE = 2;

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

  console.log(data);

  if (error) {
    console.log('error paginated videos', error);
  }

  if (!data) {
    console.log('nao ha salas');
    return;
  }

  const nextCursor = data.length < PAGE_SIZE ? undefined : pageParam + 1;

  return { data, nextCursor };
};
