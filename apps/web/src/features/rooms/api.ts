import type {
  CreateRoomBody,
  CreateRoomResponse,
  ListRoomsResponse,
  QueueItem,
  RoomDetail,
} from '@lilochat/contracts';
import { api } from '@/lib/api';

export function listRooms(input: { cursor?: string; q?: string }): Promise<ListRoomsResponse> {
  const params = new URLSearchParams();
  if (input.cursor) params.set('cursor', input.cursor);
  if (input.q) params.set('q', input.q);
  const qs = params.toString();
  return api(`/rooms${qs ? `?${qs}` : ''}`);
}

export function getRoom(roomId: string): Promise<RoomDetail> {
  return api(`/rooms/${roomId}`);
}

export function createRoom(body: CreateRoomBody, accessToken: string): Promise<CreateRoomResponse> {
  return api('/rooms', { method: 'POST', body, accessToken });
}

export function addVideo(
  roomId: string,
  videoUrl: string,
  accessToken: string,
): Promise<QueueItem> {
  return api(`/rooms/${roomId}/queue`, { method: 'POST', body: { videoUrl }, accessToken });
}

export function removeVideo(roomId: string, itemId: string, accessToken: string): Promise<void> {
  return api(`/rooms/${roomId}/queue/${itemId}`, { method: 'DELETE', accessToken });
}
