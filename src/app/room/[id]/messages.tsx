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
  const [usersIds, setUsersIds] = useState<string[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState<string>('');
  const [userNickname, setUserNickname] = useState('');
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

  const getUsers = async () => {
    const { data, error } = await supabase
      .from('users')
      .select('id')
      .eq('room_id', room.id);

    if (error) {
      console.log('Error ao buscar usuarios');
    }

    if (data && data.length > 0) {
      setUsersIds(data.map((user) => user.id));
    }
  };

  const getUserData = async () => {
    const { data, error } = await supabase
      .from('users')
      .select('avatar_url, nickname')
      .eq('id', userId)
      .single();

    if (error) {
      console.log('Error ao buscar avatar do usuário', error);
    } else {
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

  useEffect(() => {
    getUsers();
    getUserData();
    getMessages();
    scrollToBottom();

    // console.log(usersIds);

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

  interface User {
    user_id: string;
    online_at: string;
  }

  const userStatus = {
    user_id: userId,
    online_at: new Date().toISOString(),
  };

  const [users, setUsers] = useState<User[]>([]);
  const [kingRoomId, setKingRoomId] = useState('');
  console.log('USERS', users);

  useEffect(() => {
    const channel = supabase.channel('messages', {
      config: {
        presence: {
          key: 'users',
        },
      },
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        const newPresenceState = channel.presenceState();
        const updatedUsers = Array.isArray(newPresenceState.users)
          ? newPresenceState.users.map((user) => ({
              // @ts-ignore
              user_id: user.user_id,
              // @ts-ignore
              online_at: user.online_at,
            }))
          : [];
        const sortByTime = updatedUsers
          .filter((user) => user && user.user_id)
          .sort((a, b) => a.online_at - b.online_at);

        setKingRoomId(sortByTime.length > 0 ? sortByTime[0].user_id : '');

        setUsers(sortByTime);
      })
      .on('presence', { event: 'join' }, ({ key, newPresences }) => {
        console.log('new presences', newPresences);
        console.log('here');
        setUsers((prevUsers) => [
          ...prevUsers,
          {
            user_id: newPresences[0].user_id,
            online_at: newPresences[0].online_at,
          },
        ]);
      })
      .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
        setUsers((prevUsers) =>
          // @ts-ignore
          prevUsers.filter((user) => user.user_id !== leftPresences.user_id)
        );
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          const presenceTrackStatus = await channel.track(userStatus);
        }
      });

    return () => {
      channel.untrack().then(() => {
        channel.unsubscribe();
      });
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
