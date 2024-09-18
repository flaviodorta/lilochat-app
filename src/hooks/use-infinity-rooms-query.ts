import { Room } from '@/types/rooms';
import supabaseCreateClient from '@/utils/supabase/supabase-client';
import { QueryFunctionContext, useInfiniteQuery } from '@tanstack/react-query';

interface GetRoomsParams {
  searchKeyword: string;
}

interface GetRoomsResponse {
  data: Room[];
  nextCursor?: number;
}

const pageSize = 3; // Defina o pageSize fora das funções para uso geral

const getRooms = async ({
  pageParam,
  queryKey,
}: QueryFunctionContext<
  readonly [string, GetRoomsParams],
  number
>): Promise<GetRoomsResponse> => {
  const page = pageParam ?? 0;
  const [_key, { searchKeyword }] = queryKey;
  const supabase = supabaseCreateClient();

  const { data, error } = await supabase.rpc('search_rooms', {
    keyword: searchKeyword || '',
    page_number: page,
    page_size: pageSize,
  });

  if (error) {
    console.error('Error at search rooms', error);
    throw error;
  }

  return {
    data: data as Room[],
    nextCursor: data.length === pageSize ? page + 1 : undefined,
  };
};

export const useInfinityRoomsQuery = (searchKeyword: string) => {
  return useInfiniteQuery<
    GetRoomsResponse, // TQueryFnData
    Error, // TError
    GetRoomsResponse, // TData
    readonly [string, GetRoomsParams], // TQueryKey
    number // TPageParam
  >({
    queryKey: ['rooms', { searchKeyword }] as const,
    queryFn: getRooms,
    initialPageParam: 0,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  });
};
