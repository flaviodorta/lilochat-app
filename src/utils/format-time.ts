import { format } from 'date-fns';

export const formatTime = (createdAt: string) => {
  return format(new Date(createdAt), 'HH:mm'); // Exemplo de formato 12 horas
};
