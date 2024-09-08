export interface Video {
  created_at: string;
  description: string;
  id: string;
  room_id: string | null;
  tags: string[];
  thumbnail_url: string;
  title: string;
  user_id: string;
  video_id: string;
  video_url: string;
}
