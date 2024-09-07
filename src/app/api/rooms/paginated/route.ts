import { getRoomsPaginated } from '@/actions/rooms/get-rooms-paginated';
import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url); // Obter os parâmetros de busca da URL
  const page = searchParams.get('page') || '0'; // Obter o número da página

  try {
    const pageNumber = parseInt(page, 10) || 0; // Converte para número
    const data = await getRoomsPaginated(pageNumber); // Chama a função de paginação
    return NextResponse.json(data); // Retorna a resposta com os dados
  } catch (error) {
    return NextResponse.json({ error: error }, { status: 500 }); // Retorna erro
  }
}
