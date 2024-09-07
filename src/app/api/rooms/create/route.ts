import { createRoom } from '@/actions/rooms/create-room';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { roomName, videoUrl, userId } = await req.json(); // Obter os dados do corpo da requisição

    // Validação básica
    if (!roomName || !videoUrl || !userId) {
      return NextResponse.json(
        { message: 'Room name, video URL, and user ID are required' },
        { status: 400 }
      );
    }

    // Chamar a função createRoom que encapsula a lógica do Supabase
    const { data, error } = await createRoom(roomName, videoUrl, userId);

    if (error) {
      return NextResponse.json({ message: error }, { status: 400 });
    }

    // Retornar a resposta com sucesso
    return NextResponse.json({ data }, { status: 200 });
  } catch (error) {
    console.error('Erro ao processar a requisição:', error);
    return NextResponse.json(
      { message: 'Internal Server Error', error },
      { status: 500 }
    );
  }
}
