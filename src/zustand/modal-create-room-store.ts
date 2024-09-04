import { create } from 'zustand';

type ModalCreateRoomStore = {
  isOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
  toggle: () => void;
};

const modalCreateRoomStore = create<ModalCreateRoomStore>((set) => ({
  isOpen: false,
  onOpen: () => set({ isOpen: true }),
  onClose: () => set({ isOpen: false }),
  toggle: () => set((state) => ({ isOpen: !state.isOpen })),
}));

const useModalCreateRoomStore = () => modalCreateRoomStore((state) => state);

export default useModalCreateRoomStore;
