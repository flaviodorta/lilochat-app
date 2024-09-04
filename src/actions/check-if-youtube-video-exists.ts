import axios from 'axios';

const YOUTUBE_API_KEY = 'AIzaSyCP4bxIAags85Q1I6CbzgP0bZkXcfwTfV8';

export const checkIfYouTubeVideoExists = async (videoUrl: string) => {
  try {
    const videoId = new URL(videoUrl).searchParams.get('v');
    if (!videoId) {
      throw new Error('Invalid YouTube URL');
    }

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
    console.log('response yt api', response);
    const videoExists = response.data.items.length > 0;
    return videoExists;
  } catch (error) {
    console.error('Error checking YouTube video:', error);
    return false;
  }
};
