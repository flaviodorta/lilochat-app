import { Room } from '@/types/rooms'; // Assumindo que você tenha um tipo definido para Room
import supabaseServerClient from '@/utils/supabase/supabase-server';

export const getRoomData = async (roomId: string): Promise<Room | null> => {
  const supabase = await supabaseServerClient();

  const { data, error } = await supabase
    .from('rooms')
    .select('*')
    .eq('id', roomId)
    .single();

  if (error) {
    console.log('Erro ao buscar dados da sala:', error);
    return null;
  }

  return data ? data : null;
};
