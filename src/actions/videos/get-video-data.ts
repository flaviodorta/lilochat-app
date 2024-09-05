import { getVideoId } from '@/utils/get-video-id';
import axios from 'axios';

export const getVideoData = async (videoUrl: string) => {
  const videoId = getVideoId(videoUrl);
  const YOUTUBE_API_KEY = process.env.NEXT_PUBLIC_YOUTUBE_API_KEY;
  const url = `https://www.googleapis.com/youtube/v3/videos?id=${videoId}&part=snippet&key=${YOUTUBE_API_KEY}`;

  try {
    const response = await axios.get(url);
    const videoData = response.data.items[0].snippet;
    const videoDataToDatabase = {
      title: videoData.title,
      description: videoData.description,
      tags: videoData.tags || [],
      thumbnail_url: videoData.thumbnails.high.url,
    };

    return videoDataToDatabase;
  } catch (error) {
    console.error('Erro ao buscar dados do video', error);
    throw new Error('Error ao buscar dados do video');
  }
};
