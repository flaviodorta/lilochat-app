import { createRoom } from '@/actions/rooms/create-room';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { roomName, videoUrl, userId } = await req.json();

    if (!roomName || !videoUrl || !userId) {
      return NextResponse.json(
        { message: 'Room name, video URL, and user ID are required' },
        { status: 400 }
      );
    }

    const { data, error } = await createRoom(roomName, videoUrl, userId);

    if (error) {
      return NextResponse.json({ message: error }, { status: 400 });
    }

    return NextResponse.json({ data }, { status: 200 });
  } catch (error) {
    console.error('Erro ao processar a requisição:', error);
    return NextResponse.json(
      { message: 'Internal Server Error', error },
      { status: 500 }
    );
  }
}
