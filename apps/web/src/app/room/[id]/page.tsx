import type { Metadata } from 'next';
import { RoomView } from './room-view';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4100';

interface RoomSnapshot {
  name?: string;
  viewers?: number;
  playback?: { title?: string } | null;
}

/** Social previews carry the LIVE state (§7.2) — the colocated
 *  opengraph-image.tsx renders the card; here we write the words. */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  try {
    const response = await fetch(`${API_URL}/rooms/${id}`, { cache: 'no-store' });
    if (!response.ok) throw new Error(String(response.status));
    const room = (await response.json()) as RoomSnapshot;
    const playing = room.playback?.title
      ? `Now playing: ${room.playback.title}.`
      : 'The queue is open — bring the first video.';
    return {
      title: room.name ?? 'Room',
      description: `${playing} Watch together in perfect sync — nobody can pause.`,
    };
  } catch {
    return { title: 'Room' };
  }
}

export default async function RoomPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <RoomView roomId={id} />;
}
