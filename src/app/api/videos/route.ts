import { NextResponse } from 'next/server';
import { addVideoToRoom } from '@/actions/videos/add-video-to-room';

export async function POST(req: Request) {
  try {
    const { videoUrl, roomId, userId } = await req.json();

    if (!videoUrl || !roomId || !userId) {
      return NextResponse.json(
        { error: 'Todos os campos são obrigatórios' },
        { status: 400 }
      );
    }

    const data = await addVideoToRoom(videoUrl, roomId, userId);

    if (!data) {
      return NextResponse.json(
        { error: 'Erro ao adicionar vídeo' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { message: 'Vídeo adicionado com sucesso', data },
      { status: 200 }
    );
  } catch (error) {
    console.error('Erro no API route add-video:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
