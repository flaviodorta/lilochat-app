'use client';

import { type ReactNode, createContext, useRef, useContext } from 'react';
import { useStore } from 'zustand';

import {
  type RoomStore,
  createRoomStore,
  initRoomStore,
} from '@/store/room-store';

export type RoomStoreApi = ReturnType<typeof createRoomStore>;

export const RoomStoreContext = createContext<RoomStoreApi | undefined>(
  undefined
);

export interface RoomStoreProviderProps {
  children: ReactNode;
}

export const RoomStoreProvider = ({ children }: RoomStoreProviderProps) => {
  const storeRef = useRef<RoomStoreApi>();

  if (!storeRef.current) {
    storeRef.current = createRoomStore(initRoomStore());
  }

  return (
    <RoomStoreContext.Provider value={storeRef.current}>
      {children}
    </RoomStoreContext.Provider>
  );
};

export const useRoomStore = <T,>(selector: (store: RoomStore) => T): T => {
  const roomStoreContext = useContext(RoomStoreContext);

  if (!roomStoreContext) {
    throw new Error('useRoomStore must be used within RoomStoreProvider');
  }
  return useStore(roomStoreContext, selector);
};
