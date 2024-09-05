'use server';

import supabaseServerClient from '@/supabase/supabase-server';
import { getVideoId } from '@/utils/get-video-id';
import { getVideoData } from './get-video-data';

export const addVideoToRoom = async (
  videoUrl: string,
  roomId: string,
  userId: string
) => {
  const supabase = supabaseServerClient();
  const videoId = getVideoId(videoUrl);

  if (!videoId) {
    throw new Error('Incorrect video url');
  }

  const { data: maxPositionData, error: maxPositionError } = await supabase
    .from('videos')
    .select('position')
    .eq('room_id', roomId)
    .order('position', { ascending: false })
    .limit(1);

  if (maxPositionError) {
    throw new Error(maxPositionError.message);
  }

  const nextPosition =
    maxPositionData.length > 0 ? maxPositionData[0].position + 1 : 1;

  const videoData = await getVideoData(videoUrl);

  const { data, error } = await supabase
    .from('videos')
    .insert([
      {
        user_id: userId,
        room_id: roomId,
        video_url: videoUrl,
        video_id: videoId,
        title: videoData.title,
        description: videoData.description,
        thumbnail_url: videoData.thumbnail_url,
        tags: videoData.tags,
        position: nextPosition,
      },
    ])
    .select();

  console.log('video data', data);

  if (error) {
    console.log('error ao inserir video no banco de dados', error);
  }

  return data;
};
