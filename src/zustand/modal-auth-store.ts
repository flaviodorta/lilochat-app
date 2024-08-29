import { create } from 'zustand';

type ModalAuthStore = {
  isOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
  toggle: () => void;
};

const modalAuthStore = create<ModalAuthStore>((set) => ({
  isOpen: false,
  onOpen: () => set({ isOpen: true }),
  onClose: () => set({ isOpen: false }),
  toggle: () => set((state) => ({ isOpen: !state.isOpen })),
}));

const useModalAuthStore = () => modalAuthStore((state) => state);

export default useModalAuthStore;
