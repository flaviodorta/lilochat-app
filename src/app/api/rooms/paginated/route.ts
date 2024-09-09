import { getRoomsPaginated } from '@/actions/rooms/get-rooms-paginated';
import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const page = searchParams.get('page') || '0';

  try {
    const pageNumber = parseInt(page, 10) || 0;
    const data = await getRoomsPaginated(pageNumber);
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: error }, { status: 500 });
  }
}
