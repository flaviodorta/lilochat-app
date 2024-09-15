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
import { User } from '@/types/user';
import { useRoomStore } from '@/providers/room-provider';
import { getColorFromString } from '@/utils/get-color-from-string';
import { formatTime } from '@/utils/format-time';

type Props = {
  user: User;
  room: Room;
};

const Messages = ({ room, user }: Props) => {
  const {
    users,
    messages,
    kingRoomId,
    setUsers,
    setMessages,
    setKingRoomId,
    addMessage,
    addUser,
    removeUser,
  } = useRoomStore((state) => state);

  const [newMessage, setNewMessage] = useState<string>('');
  const [isFirstRender, setIsFirstRender] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(true);

  const textareaRef = useRef<HTMLTextAreaElement>(null!);
  const messagesEndRefs = useRef<HTMLDivElement>(null!);

  const supabase = supabaseCreateClient();

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

  const handleGlobalKeyPress = async (
    event: KeyboardEvent | React.KeyboardEvent<HTMLTextAreaElement>
  ) => {
    if (event.key === 'Enter' && !event.shiftKey) {
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

  const sendMessage = async () => {
    if (newMessage.trim()) {
      const { error } = await supabase.from('messages').insert({
        room_id: room.id,
        user_id: user.id,
        content: newMessage,
        user_nickname: user.nickname,
      });

      if (!error) {
        setNewMessage('');
      } else {
        console.log('error ao enviar mensagem');
      }
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

  useEffect(() => {
    getMessages();
    scrollToBottom();

    const messagesListener = supabase
      .channel(`messages-room-${room.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `room_id=eq.${room.id}`,
        },
        (payload: any) => {
          addMessage(payload.new);
          scrollToBottom();
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(messagesListener);
    };
  }, []);

  useEffect(() => {
    const updateUserRoomId = async (roomId: string | null) => {
      const { error: addUserToRoomError } = await supabase
        .from('users')
        .update({ room_id: roomId })
        .eq('id', user.id);

      if (addUserToRoomError) {
        console.error('Erro ao atualizar o room_id:', addUserToRoomError);
      }
    };

    updateUserRoomId(room.id);

    return () => {
      updateUserRoomId(null);
    };
  }, []);

  if (isFirstRender) return null;

  return (
    <div className='w-full p-4 h-full flex flex-col bg-gray-100'>
      <div className='pb-4 bg-gray-100 flex justify-between items-center'>
        <h1 className='text-xl font-bold'>Chat with strangers</h1>
      </div>

      <ul className='flex-1 w-full h-full justify-center rounded-lg overflow-y-scroll scrollbar-thin p-4 bg-white'>
        {isLoadingMessages ? (
          <div className='w-full h-full flex items-center justify-center'>
            <Spinner />
          </div>
        ) : (
          messages
            .slice(messages.length - 200, messages.length)
            .map((msg, index) => (
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
                    {msg.user_id === kingRoomId && (
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
          placeholder='Digite sua mensagem'
          onChange={(e) => setNewMessage(e.target.value)}
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
