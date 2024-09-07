import supabaseServerClient from '@/utils/supabase/supabase-server';
import { NextApiRequest, NextApiResponse } from 'next';
import { addVideoToRoom } from '../videos/add-video-to-room';
import { getUserData } from '../user/get-user-data';
import { getVideoData } from '../videos/get-video-data';
import { Room } from '@/types/rooms';

export const createRoom = async (
  roomName: string,
  videoUrl: string,
  userId: string
) => {
  const supabase = supabaseServerClient();

  const userData = await getUserData();

  const videoData = await getVideoData(videoUrl);

  if (!userData) {
    throw new Error('user not authenticated');
  }

  const { data: roomData, error: roomError } = await supabase
    .from('rooms')
    .insert([
      {
        name: roomName,
        video_time: 0,
        video_is_playing: true,
        user_id: userId,
        video_thumbnail_url: videoData.thumbnail_url,
        video_url: videoUrl,
      },
    ])
    .select()
    .single();

  if (roomData) {
    console.log(roomData);

    const videoData = await addVideoToRoom(videoUrl, roomData.id, userId);

    // Verifica se o vídeo foi adicionado corretamente
    if (videoData) {
      console.log('Vídeo adicionado com sucesso à sala:', videoData);
    } else {
      console.error('Erro ao adicionar vídeo à sala');
    }
  }

  if (roomError) {
    console.error(roomError);
    return { error: roomError.message };
  }

  return { data: roomData };
};
