'use client';

import { getVideoId } from '@/utils/get-video-id';
import axios from 'axios';

const YOUTUBE_API_KEY = 'AIzaSyCP4bxIAags85Q1I6CbzgP0bZkXcfwTfV8';

export const checkIfYouTubeVideoExists = async (videoUrl: string) => {
  try {
    const videoId = getVideoId(videoUrl);

    if (!videoId) {
      throw new Error('Invalid YouTube URL');
    }
    console.log('video id', videoId);
    const response = await axios.get(
      'https://www.googleapis.com/youtube/v3/videos',
      {
        params: {
          id: videoId,
          key: YOUTUBE_API_KEY,
          part: 'id',
        },
      }
    );

    const videoExists = response.data.items.length > 0;

    if (videoExists) {
      return videoExists;
    } else {
      throw new Error('Video nao existe');
    }
  } catch (error) {
    console.error('Error checking YouTube video:\n', error);
    return false;
  }
};
