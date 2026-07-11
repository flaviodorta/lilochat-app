'use client';

import { useQueryClient, type InfiniteData } from '@tanstack/react-query';
import { useEffect } from 'react';
import { io } from 'socket.io-client';
import type { ListRoomsResponse } from '@lilochat/contracts';
import { WS_URL } from './use-room-sync';

/** Live viewer counts for the home cards: /lobby is public, no auth needed. */
export function useLobbyViewers(): void {
  const queryClient = useQueryClient();

  useEffect(() => {
    const socket = io(`${WS_URL}/lobby`, { transports: ['websocket'] });

    socket.on('room:summary', ({ roomId, viewers }: { roomId: string; viewers: number }) => {
      queryClient.setQueriesData<InfiniteData<ListRoomsResponse>>(
        { queryKey: ['rooms'] },
        (data) =>
          data && {
            ...data,
            pages: data.pages.map((page) => ({
              ...page,
              items: page.items.map((item) => (item.id === roomId ? { ...item, viewers } : item)),
            })),
          },
      );
    });

    return () => {
      socket.disconnect();
    };
  }, [queryClient]);
}
