'use client';

import { Message } from '@/types/message';
import supabaseCreateClient from '@/utils/supabase/supabase-client';
import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { FaChessKing, FaUser } from 'react-icons/fa6';
import { format } from 'date-fns';
import Spinner from '@/components/spinner';
import { cn } from '@/utils/cn';
import { RiVipCrown2Fill } from 'react-icons/ri';
import { Room } from '@/types/rooms';
// import { useRouter } from 'next/router';

type Props = {
  userId: string;
  room: Room;
};

const formatTime = (createdAt: string) => {
  return format(new Date(createdAt), 'HH:mm'); // Exemplo de formato 12 horas
};

const getColorFromString = (str: string) => {
  const colors = [
    'text-red-600',
    'text-blue-600',
    'text-green-600',
    'text-yellow-600',
    'text-purple-600',
    'text-pink-600',
    'text-indigo-600',
    'text-teal-600',
    'text-orange-600',
    'text-rose-600',
    'text-violet-600',
    'text-lime-600',
    'text-amber-600',
    'text-emerald-600',
    'text-cyan-600',
    'text-sky-600',
    'text-fuchsia-600',
  ];
  // @ts-ignore
  const hash = [...str].reduce((acc, char) => acc + char.charCodeAt(0), 0);

  const colorIndex = hash % colors.length;

  return colors[colorIndex];
};

const Messages = ({ room, userId }: Props) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState<string>('');
  // const [userAvatarUrl, setUserAvatarUrl] = useState('');
  const [userNickname, setUserNickname] = useState('');
  const [isFirstRender, setIsFirstRender] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(true);
  // const [isKingRoom, setIsKingRoom] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null!);
  const messagesEndRefs = useRef<HTMLDivElement>(null!);

  const supabase = supabaseCreateClient();

  // console.log('room', room);

  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    if (messagesEndRefs.current)
      messagesEndRefs.current.scrollIntoView({ behavior });
  };

  useEffect(() => {
    if (isFirstRender) {
      setTimeout(() => {
        scrollToBottom('auto');
      }, 100);
      setIsFirstRender(false);
    } else {
      scrollToBottom('smooth');
    }
  }, [messages]);

  useEffect(() => {
    const handleFirstKeyPress = (event: KeyboardEvent) => {
      if (!textareaRef.current) return;

      if (event.key.length === 1) {
        textareaRef.current.focus();
        setNewMessage((prev) => prev + event.key);
      }
    };

    window.addEventListener('keydown', handleFirstKeyPress);

    return () => {
      window.removeEventListener('keydown', handleFirstKeyPress);
    };
  }, []);

  const sendMessage = async () => {
    if (newMessage.trim()) {
      const { error } = await supabase.from('messages').insert({
        room_id: room.id,
        user_id: userId,
        content: newMessage,
        // avatar_url: userAvatarUrl,
        user_nickname: userNickname,
      });

      if (!error) {
        setNewMessage('');
      } else {
        console.log('error ao enviar mensagem');
      }
    }
  };

  const handleGlobalKeyPress = async (
    event: KeyboardEvent | React.KeyboardEvent<HTMLTextAreaElement>
  ) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      console.log('enter');
      event.preventDefault();
      await sendMessage();
    }
  };

  useEffect(() => {
    window.addEventListener('keydown', handleGlobalKeyPress);

    return () => {
      window.removeEventListener('keydown', handleGlobalKeyPress);
    };
  }, [newMessage]);

  const getUserData = async () => {
    const { data, error } = await supabase
      .from('users')
      .select('avatar_url, nickname')
      .eq('id', userId)
      .single();

    if (error) {
      console.log('Error ao buscar avatar do usuário', error);
    } else {
      // setUserAvatarUrl(data.avatar_url);
      setUserNickname(data.nickname);
    }
  };

  const getMessages = async () => {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('room_id', room.id);

    if (error) {
      console.log('Error ao buscar mensagens', messages);
    } else {
      setIsLoadingMessages(false);
      setMessages(data);
    }
  };
  const [kingId, setKingId] = useState(room.user_id);

  useEffect(() => {
    console.log('king id', kingId);
  }, [kingId]);
  // receber as mensagens do banco de dados

  useEffect(() => {
    getUserData();
    getMessages();
    scrollToBottom();

    const messagesListener = supabase
      .channel('messages-room-channel')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `room_id=eq.${room.id}`,
        },
        (payload: any) => {
          setMessages((prevMessages) => [...prevMessages, payload.new]);
          scrollToBottom();
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(messagesListener);
    };
  }, []);

  useEffect(() => {
    const kingIdListener = supabase
      .channel('room-channel')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'rooms',
          filter: `id=eq.${room.id}`,
        },
        (payload) => {
          console.log('Mudança detectada no room', payload);
          if (payload.new.user_id) {
            setKingId(payload.new.user_id);
          }
        }
      )
      .subscribe((status) => {
        console.log('Subscrição ao canal de room:', status);
      });

    return () => {
      supabase.removeChannel(kingIdListener);
    };
  }, [room.id]);

  const removeUserFromRoom = async () => {
    const { data, error: removeUserFromRoomError } = await supabase
      .from('users')
      .update({ room_id: null })
      .eq('id', userId);

    if (removeUserFromRoomError) {
      console.log('Erro ao remover usuário da sala', removeUserFromRoomError);
    }
    console.log('Usuário removido da sala', data);
  };

  const addUserToRoom = async () => {
    const { error: addUserToRoomError } = await supabase
      .from('users')
      .update({ room_id: room.id })
      .eq('id', userId);

    if (addUserToRoomError) {
      console.log('Erro ao adicionar usuário da sala', addUserToRoomError);
    }
  };

  useEffect(() => {
    addUserToRoom();

    return () => {
      removeUserFromRoom();
    };
  }, []);

  // const router = useRouter();

  // const router = useRouter();
  // useEffect(() => {
  //   const handleRouteChange = () => {
  //     removeUserFromRoom();
  //   };

  //   router.events.on('routeChangeStart', handleRouteChange);

  //   return () => {
  //     router.events.off('routeChangeStart', handleRouteChange);
  //   };
  // }, []);

  // apenas teste
  const getUsersInRoom = async () => {
    const { count } = await supabase
      .from('users')
      .select('id', { count: 'exact' })
      .eq('room_id', room.id);

    console.log('Usuarios na sala', count);
    console.log('is king room', kingId === userId);
  };

  const getKingRoomId = async () => {
    const { data, error } = await supabase
      .from('rooms')
      .select('user_id')
      .eq('id', room.id);

    if (error) {
    }
    console.log('king room id', data);
  };

  const changeKingRoom = async () => {
    try {
      const { data, error: updateKingRoomError } = await supabase
        .from('rooms')
        .update({ user_id: userId }) // Valor hardcoded
        .eq('id', room.id);

      if (updateKingRoomError) {
        console.error('Erro ao atualizar o dono da sala:', updateKingRoomError);
        return;
      }

      console.log('Atualização do dono da sala bem-sucedida:', data);
    } catch (error) {
      console.error('Erro inesperado ao tentar mudar o dono da sala:', error);
    }
  };

  // setar o user caso seja o dono da sala
  // useEffect(() => {
  //   if (room.user_id === userId) setIsKingRoom(true);
  // }, []);

  if (isFirstRender) return null;

  return (
    <div className='w-full p-4 h-full flex flex-col bg-gray-100'>
      <div className='pb-4 bg-gray-100 flex justify-between items-center'>
        <h1 className='text-xl font-bold'>Chat with strangers</h1>
      </div>
      <button className='bg-red-600' onClick={getUsersInRoom}>
        Click
      </button>
      <button className='bg-green-600' onClick={getKingRoomId}>
        Click
      </button>
      <button className='bg-blue-600' onClick={changeKingRoom}>
        Click
      </button>

      <ul className='flex-1 w-full h-full justify-center rounded-lg overflow-y-scroll scrollbar-thin p-4 bg-white'>
        {isLoadingMessages ? (
          <div className='w-full h-full flex items-center justify-center'>
            <Spinner />
          </div>
        ) : (
          messages.map((msg, index) => (
            <li
              key={index}
              className='pb-4 overflow-hidden w-full flex items-start justify-between  bg-white'
            >
              <div className='flex w-full flex-col'>
                <div className='pb-1 flex items-center w-full overflow-hidden gap-2'>
                  <div className='font-bold '>
                    {msg.user_nickname ? (
                      <Image
                        src={`https://api.multiavatar.com/${msg.user_nickname}.png?apikey=${process.env.NEXT_PUBLIC_YOUTUBE_API_KEY}`}
                        width={24}
                        height={24}
                        alt='Avatar'
                      />
                    ) : (
                      <FaUser />
                    )}
                  </div>
                  <span
                    className={cn([
                      'text-sm font-bold text-purple-600 break-words',
                      getColorFromString(msg.user_nickname),
                    ])}
                  >
                    {msg.user_nickname}
                  </span>
                  {msg.user_id === kingId && (
                    <span className='text-yellow-500 mr-auto -translate-y-[1px]'>
                      <RiVipCrown2Fill />
                    </span>
                  )}

                  <span className='text-xs ml-auto'>
                    {formatTime(msg.created_at)}
                  </span>
                </div>

                <div className='w-full break-words'>{msg.content}</div>
              </div>
            </li>
          ))
        )}
        <div ref={messagesEndRefs} />
      </ul>

      <div className='pt-2 bg-gray-100 border-gray-300'>
        <textarea
          ref={textareaRef}
          value={newMessage}
          readOnly
          placeholder='Digite sua mensagem'
          rows={3}
          className='w-full p-2 border rounded-md mb-2 outline-none resize-none riws'
        />
        <button
          onClick={sendMessage}
          className='w-full bg-purple-600 text-white p-2 rounded-md'
        >
          Enviar
        </button>
      </div>
    </div>
  );
};
export default Messages;
