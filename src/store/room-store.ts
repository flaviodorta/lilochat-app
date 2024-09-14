import { createStore } from 'zustand/vanilla';

export interface User {
  user_id: string;
  nickname: string;
  online_at: string;
}

interface UserMessage {
  user_id: string;
  content: string;
  user_nickname: string;
  created_at: string;
}

interface LogMessage {
  user_id: string;
  content: string;
  created_at: string;
}

export type RoomMessage = UserMessage;

type RoomState = {
  users: User[];
  kingRoomId: string;
  messages: RoomMessage[];
};

type RoomActions = {
  setUsers: (users: User[]) => void;
  addUser: (user: User) => void;
  removeUser: (user_id: string) => void;
  setKingRoomId: (id: string) => void;
  addMessage: (message: RoomMessage) => void;
  setMessages: (messages: RoomMessage[]) => void;
};

export type RoomStore = RoomState & RoomActions;

export const initRoomStore = (): RoomState => {
  return { users: [], messages: [], kingRoomId: '' };
};

const defaultInitStore: RoomState = {
  users: [],
  kingRoomId: '',
  messages: [],
};

export const createRoomStore = (initState: RoomState = defaultInitStore) => {
  return createStore<RoomStore>()((set) => ({
    ...initState,
    setUsers: (users) => set({ users }),
    addUser: (user) => {
      set((state) => ({
        users: [...state.users, user], // Garantindo imutabilidade
      }));
    },
    removeUser: (user_id) => {
      set((state) => ({
        users: state.users.filter((u) => u.user_id !== user_id), // Removendo usuário de forma imutável
      }));
    },
    setKingRoomId: (id) => set({ kingRoomId: id }),
    setMessages: (messages) => set({ messages }),
    addMessage: (message) => {
      set((state) => ({
        messages: [...state.messages, message], // Garantindo imutabilidade
      }));
    },
  }));
};
