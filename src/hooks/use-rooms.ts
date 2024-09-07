import { getRoomsPaginated } from '@/actions/rooms/get-rooms-paginated';
import { useInfiniteQuery } from '@tanstack/react-query';
import axios from 'axios';

const getRooms = async ({ pageParam = 0 }) => {
  const { data } = await axios.get(`/api/rooms/paginated?page=${pageParam}`);
  return data;
};

export const useRooms = () => {
  return useInfiniteQuery({
    queryKey: ['rooms'],
    queryFn: getRooms,
    initialPageParam: 0,
    getNextPageParam: (lastPage, pages) => lastPage.nextCursor,
  });
};
