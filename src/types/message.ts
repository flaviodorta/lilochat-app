export interface Message {
  avatar_url: string | null;
  content: string | null;
  created_at: string;
  id: string;
  room_id: string | null;
  user_id: string | null;
  user_nickname: string;
}
