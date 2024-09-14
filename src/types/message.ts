export interface Message {
  content: string | null;
  created_at: string;
  id: string;
  room_id: string | null;
  user_id: string | null;
  user_nickname: string;
}
