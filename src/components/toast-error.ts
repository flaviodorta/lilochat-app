import { useToast } from '@chakra-ui/react';

const ToastError = (title: string) => {
  const toast = useToast();

  return toast({
    title,
    status: 'error',
    duration: 5000,
    isClosable: true,
  });
};

export default ToastError;
