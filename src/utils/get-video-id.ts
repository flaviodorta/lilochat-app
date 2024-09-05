export const getVideoId = (videoUrl: string) => {
  const id = new URL(videoUrl).searchParams.get('v');

  if (!id) {
    throw new Error('Incorrect video url');
  }

  return id;
};
