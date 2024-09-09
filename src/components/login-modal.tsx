'use client';

import {
  Button,
  Checkbox,
  Divider,
  Input,
  InputGroup,
  InputLeftElement,
  InputRightElement,
  Modal,
  ModalBody,
  ModalContent,
  ModalHeader,
  ModalOverlay,
  Stack,
  useToast,
} from '@chakra-ui/react';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import axios from 'axios';

import { FaKey, FaUser, FaRegEye, FaRegEyeSlash } from 'react-icons/fa6';
import { useBoolean } from 'usehooks-ts';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import signUpWithEmail from '@/actions/auth/signup-with-email';
// import { useAuth } from '@/context/auth-context';
import signInWithEmail from '@/actions/auth/signin-with-email';
import Error from 'next/error';

type Dimension = {
  w: number;
  h: number;
};

const AuthModal = ({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) => {
  const [modal, setModal] = useState('login');
  const [dimension, setDimension] = useState<Dimension>({ w: 340, h: 380 });

  useEffect(() => {
    if (modal === 'signup') setDimension((state) => ({ ...state, h: 460 }));
    if (modal === 'login') setDimension((state) => ({ ...state, h: 510 }));
  }, [modal]);

  // const { isAuthenticated } = useAuth();

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <ModalOverlay />
      <ModalContent className='min-w-[300px]'>
        <motion.div
          initial={false}
          animate={{ height: dimension.h }}
          className='relative overflow-hidden w-full rounded-lg'
        >
          <SignInBody modal={modal} setModal={setModal} onClose={onClose} />
          <SignUpBody modal={modal} setModal={setModal} />
        </motion.div>
      </ModalContent>
    </Modal>
  );
};

export default AuthModal;

const SignUpBody = ({
  modal,
  setModal,
}: {
  modal: string;
  setModal: React.Dispatch<React.SetStateAction<string>>;
}) => {
  const { value: showPassword, toggle: toggleShowPassword } = useBoolean();
  const toast = useToast();

  const formSchema = z.object({
    email: z.string().email('Invalid email address.'),
    password: z.string().min(6, 'Password must be at least 6 characters long.'),
  });

  // const { setIsAuthenticated, setUser } = useAuth();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    try {
      const user = await signUpWithEmail(values);
      if (user) {
        toast({
          title: 'Confirm account in your email',
          status: 'success',
          duration: 5000,
          isClosable: true,
        });
        setModal('login');
      }
    } catch (err) {
      toast({
        title: 'Create account failed',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    }
  };

  return (
    <motion.div
      initial={false}
      animate={{ x: modal === 'signup' ? '0' : '100%' }}
      transition={{ bounce: 0 }}
      className='absolute w-full'
    >
      <ModalHeader className='text-center'>Sign up Lilo Chat</ModalHeader>
      <ModalBody>
        <form onSubmit={handleSubmit(onSubmit)}>
          <Stack spacing={4}>
            <div className='text-center'>
              Have account yet?{' '}
              <div
                onClick={() => setModal('login')}
                className='text-purple-600 inline-block cursor-pointer font-bold transition-colors duration-75 hover:text-purple-700'
              >
                Sign in here
              </div>
            </div>

            <InputGroup className='flex flex-col gap-1'>
              <InputLeftElement pointerEvents='none'>
                <FaUser className='text-gray-300' />
              </InputLeftElement>
              <Input
                {...register('email')}
                type='email'
                placeholder='Enter email'
                isInvalid={!!errors.email}
              />
              {errors.email && (
                <div className='text-red-500 text-xs'>
                  {errors.email.message}
                </div>
              )}
            </InputGroup>

            <InputGroup className='flex flex-col gap-1'>
              <InputLeftElement color='gray.300'>
                <FaKey />
              </InputLeftElement>
              <Input
                {...register('password')}
                type={showPassword ? 'text' : 'password'}
                placeholder='Enter password'
                isInvalid={!!errors.password}
              />
              <InputRightElement className='mr-2'>
                <Button h='1.75rem' size='sm' onClick={toggleShowPassword}>
                  {showPassword ? <FaRegEye /> : <FaRegEyeSlash />}
                </Button>
              </InputRightElement>
              {errors.password && (
                <div className='text-red-500 text-xs'>
                  {errors.password.message}
                </div>
              )}
            </InputGroup>

            <button type='submit' className='button-2' onClick={undefined}>
              Sign Up
            </button>

            <Divider />

            <button
              type='button'
              className='text-white justify-center text-center bg-[#3b5998] hover:bg-[#3b5998]/90 focus:ring-4 focus:outline-none focus:ring-[#3b5998]/50 font-medium rounded-lg text-sm px-5 py-2.5 inline-flex items-center dark:focus:ring-[#3b5998]/55'
            >
              <svg
                className='w-4 h-4 mr-2'
                aria-hidden='true'
                xmlns='http://www.w3.org/2000/svg'
                fill='currentColor'
                viewBox='0 0 8 19'
              >
                <path
                  fillRule='evenodd'
                  d='M6.135 3H8V0H6.135a4.147 4.147 0 0 0-4.142 4.142V6H0v3h2v9.938h3V9h2.021l.592-3H5V3.591A.6.6 0 0 1 5.592 3h.543Z'
                  clipRule='evenodd'
                />
              </svg>
              Sign up with Facebook
            </button>

            <button
              type='button'
              className='text-white justify-center bg-[#4285F4] hover:bg-[#4285F4]/90 focus:ring-4 focus:outline-none focus:ring-[#4285F4]/50 font-medium rounded-lg text-sm px-5 py-2.5 text-center inline-flex items-center dark:focus:ring-[#4285F4]/55'
              onClick={undefined}
            >
              <svg
                className='w-4 h-4 mr-2'
                aria-hidden='true'
                xmlns='http://www.w3.org/2000/svg'
                fill='currentColor'
                viewBox='0 0 18 19'
              >
                <path
                  fillRule='evenodd'
                  d='M8.842 18.083a8.8 8.8 0 0 1-8.65-8.948 8.841 8.841 0 0 1 8.8-8.652h.153a8.464 8.464 0 0 1 5.7 2.257l-2.193 2.038A5.27 5.27 0 0 0 9.09 3.4a5.882 5.882 0 0 0-.2 11.76h.124a5.091 5.091 0 0 0 5.248-4.057L14.3 11H9V8h8.34c.066.543.095 1.09.088 1.636-.086 5.053-3.463 8.449-8.4 8.449l-.186-.002Z'
                  clipRule='evenodd'
                />
              </svg>
              Sign up with Google
            </button>
          </Stack>
        </form>
      </ModalBody>
    </motion.div>
  );
};

const SignInBody = ({
  modal,
  setModal,
  onClose,
}: {
  modal: string;
  setModal: React.Dispatch<React.SetStateAction<string>>;
  onClose: () => void;
}) => {
  const { value: showPassword, toggle: toggleShowPassword } = useBoolean();

  const formSchema = z.object({
    email: z.string().email('Invalid email address.'),
    password: z.string().min(6, 'Password must be at least 6 characters long.'),
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  // const { setIsAuthenticated } = useAuth();

  const toast = useToast();

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    const { data: d, error: e } = await signInWithEmail(values);
    const data = JSON.parse(d);
    const error = JSON.parse(e);

    if (data.session?.access_token) {
      // setIsAuthenticated(true);
      onClose();
      toast({
        title: 'Login Sucessfull',
        status: 'success',
        duration: 5000,
        isClosable: true,
      });
    } else if (error) {
      console.log(error);
      toast({
        title: "Invalid credentials or account don't exist",
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    }
    // else if (error) setIsAuthenticated(false);
  };

  return (
    <motion.div
      initial={false}
      animate={{ x: modal === 'login' ? 0 : '-100%' }}
      transition={{ bounce: 0 }}
      className='absolute w-full'
    >
      <ModalHeader className='text-center'>Log in to your account</ModalHeader>
      <ModalBody>
        <form onSubmit={handleSubmit(onSubmit)}>
          <Stack spacing={4}>
            <div className='text-center'>
              Don{"'"}t have account yet?{' '}
              <div
                onClick={() => setModal('signup')}
                className='text-purple-600 inline-block cursor-pointer font-bold transition-colors duration-75 hover:text-purple-700'
              >
                Sign up here
              </div>
            </div>

            <InputGroup className='flex flex-col gap-1'>
              <InputLeftElement pointerEvents='none'>
                <FaUser className='text-gray-300' />
              </InputLeftElement>
              <Input
                {...register('email')}
                type='email'
                placeholder='Enter email'
                isInvalid={!!errors.email}
              />
              {errors.email && (
                <div className='text-red-500 text-xs'>
                  {errors.email.message}
                </div>
              )}
            </InputGroup>

            <InputGroup className='flex flex-col gap-1'>
              <InputLeftElement color='gray.300'>
                <FaKey />
              </InputLeftElement>
              <Input
                {...register('password')}
                type={showPassword ? 'text' : 'password'}
                placeholder='Enter password'
                isInvalid={!!errors.password}
              />
              <InputRightElement className='mr-2'>
                <Button h='1.75rem' size='sm' onClick={toggleShowPassword}>
                  {showPassword ? <FaRegEye /> : <FaRegEyeSlash />}
                </Button>
              </InputRightElement>
              {errors.password && (
                <div className='text-red-500 text-xs'>
                  {errors.password.message}
                </div>
              )}
            </InputGroup>

            <div className='flex justify-between'>
              <Checkbox colorScheme='purple'>Remember me</Checkbox>

              <div className='text-purple-600 cursor-pointer font-bold'>
                Forgot password
              </div>
            </div>

            <button type='submit' className='button-2' onClick={undefined}>
              Sign In
            </button>

            <Divider />

            <button
              type='button'
              className='text-white justify-center text-center bg-[#3b5998] hover:bg-[#3b5998]/90 focus:ring-4 focus:outline-none focus:ring-[#3b5998]/50 font-medium rounded-lg text-sm px-5 py-2.5 inline-flex items-center dark:focus:ring-[#3b5998]/55'
            >
              <svg
                className='w-4 h-4 mr-2'
                aria-hidden='true'
                xmlns='http://www.w3.org/2000/svg'
                fill='currentColor'
                viewBox='0 0 8 19'
              >
                <path
                  fillRule='evenodd'
                  d='M6.135 3H8V0H6.135a4.147 4.147 0 0 0-4.142 4.142V6H0v3h2v9.938h3V9h2.021l.592-3H5V3.591A.6.6 0 0 1 5.592 3h.543Z'
                  clipRule='evenodd'
                />
              </svg>
              Log in with Facebook
            </button>

            <button
              onClick={undefined}
              type='button'
              className='text-white justify-center bg-[#4285F4] hover:bg-[#4285F4]/90 focus:ring-4 focus:outline-none focus:ring-[#4285F4]/50 font-medium rounded-lg text-sm px-5 py-2.5 text-center inline-flex items-center dark:focus:ring-[#4285F4]/55'
            >
              <svg
                className='w-4 h-4 mr-2'
                aria-hidden='true'
                xmlns='http://www.w3.org/2000/svg'
                fill='currentColor'
                viewBox='0 0 18 19'
              >
                <path
                  fillRule='evenodd'
                  d='M8.842 18.083a8.8 8.8 0 0 1-8.65-8.948 8.841 8.841 0 0 1 8.8-8.652h.153a8.464 8.464 0 0 1 5.7 2.257l-2.193 2.038A5.27 5.27 0 0 0 9.09 3.4a5.882 5.882 0 0 0-.2 11.76h.124a5.091 5.091 0 0 0 5.248-4.057L14.3 11H9V8h8.34c.066.543.095 1.09.088 1.636-.086 5.053-3.463 8.449-8.4 8.449l-.186-.002Z'
                  clipRule='evenodd'
                />
              </svg>
              Sign in with Google
            </button>
          </Stack>
        </form>
      </ModalBody>
    </motion.div>
  );
};
