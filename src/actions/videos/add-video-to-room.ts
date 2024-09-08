'use server';

import supabaseServerClient from '@/utils/supabase/supabase-server';
import { getVideoId } from '@/utils/get-video-id';
import { getVideoData } from './get-video-data';

export const addVideoToRoom = async (
  videoUrl: string,
  roomId: string,
  userId: string
) => {
  const supabase = supabaseServerClient();
  const videoId = getVideoId(videoUrl);

  const videoData = await getVideoData(videoUrl);

  const { data, error } = await supabase
    .from('videos')
    .insert([
      {
        user_id: userId,
        room_id: roomId,
        video_url: videoUrl.trim(),
        video_id: videoId,
        title: videoData.title,
        description: videoData.description,
        thumbnail_url: videoData.thumbnail_url,
        tags: videoData.tags,
      },
    ])
    .select();

  if (error) {
    console.log('error ao inserir video no banco de dados', error);
  }

  return data;
};
