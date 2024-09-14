'use client';

import { createContext, useContext, useEffect, useRef, useState } from 'react';
import supabaseCreateClient from '@/utils/supabase/supabase-client';
import { RealtimeChannel } from '@supabase/supabase-js';
import { Message } from '@/types/message';

type RoomContextProps = {
  videoUrl: string;
  playing: boolean;
  videoTime: number;
  setPlaying: (playing: boolean) => void;
  setVideoTime: (time: number) => void;
  users: any[];
  messages: Message[];
  isLoadingMessages: boolean;
  sendPlay: () => void;
  sendPause: () => void;
  kingRoomId: string;
  isKing: boolean;
  isFirstRender: boolean;
};

const RoomContext = createContext<RoomContextProps | undefined>(undefined);

export const useRoom = () => {
  const context = useContext(RoomContext);

  if (!context) {
    throw new Error('useRoom must be used within a RoomProvider');
  }

  return context;
};

type RoomProviderPros = {
  children: React.ReactNode;
  room: any;
  userId: string;
};

export const RoomProvider = ({ children, room, userId }: RoomProviderPros) => {
  const [videoUrl, setVideoUrl] = useState(room.video_url);
  const [playing, setPlaying] = useState(true);
  const [videoTime, setVideoTime] = useState(room.video_time);

  const [kingRoomId, setKingRoomId] = useState('');
  const [users, setUsers] = useState<any[]>([]);

  const [messages, setMessages] = useState<Message[]>([]);
  const messagesEndRefs = useRef<HTMLDivElement>(null!);
  const [isFirstRender, setIsFirstRender] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(true);

  const supabase = supabaseCreateClient();
  const [channel, setChannel] = useState<RealtimeChannel | null>(null);

  const isKing = kingRoomId === userId;

  const sendPlay = () => {
    if (!isKing || !channel) return;
    setPlaying(true);
    channel.send({
      type: 'broadcast',
      event: 'video-status',
      payload: { playing: true, time: videoTime },
    });
  };

  const sendPause = () => {
    if (!isKing || !channel) return;
    setPlaying(false);
    channel.send({
      type: 'broadcast',
      event: 'video-status',
      payload: { playing: false, time: videoTime },
    });
  };

  useEffect(() => {
    const roomChannel = supabase.channel(`room_${room.id}`);

    roomChannel
      .on('broadcast', { event: 'video-status' }, (state) => {
        // Somente usuários não "King" recebem e atualizam o estado
        if (!isKing) {
          setPlaying(state.payload.playing);
          setVideoTime(state.payload.time);
        }
      })
      .on('broadcast', { event: 'join-video-status' }, (state) => {
        if (!isKing && state.payload.user_id === userId) {
          setPlaying(state.payload.playing);
          setVideoTime(state.payload.time);
        }
      })
      .on('presence', { event: 'sync' }, () => {
        const newPresenceState = roomChannel.presenceState();
        console.log('new presence state', newPresenceState);
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

        console.log('update users', updatedUsers);

        setKingRoomId(sortByTime.length > 0 ? sortByTime[0].user_id : '');

        setUsers(sortByTime);

        // Se o "King" estiver presente, envia o estado atual do vídeo para o novo usuário
        // if (isKing) {
        //   const kingState = { playing, time: videoTime };
        //   roomChannel.send({
        //     type: 'broadcast',
        //     event: 'join-video-status',
        //     payload: kingState,
        //   });
        // }
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

        // Quando um novo usuário entra, se o "King" estiver presente, envia o estado atual
        if (isKing) {
          const kingState = { playing, time: videoTime, user_id: key };
          console.log('king state on join', kingState);
          roomChannel.send({
            type: 'broadcast',
            event: 'video-status',
            payload: kingState,
          });
        }
      })
      .on('presence', { event: 'leave' }, ({ key }) => {
        setUsers((prevUsers) =>
          // @ts-ignore
          prevUsers.filter((user) => user.user_id !== leftPresences.user_id)
        );
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setChannel(roomChannel);
          roomChannel.track({
            user_id: userId,
            online_at: new Date().toISOString(),
          });
        }
      });

    return () => {
      roomChannel.untrack().then(() => {
        roomChannel.unsubscribe();
      });
    };
  }, [room, supabase]);

  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    if (messagesEndRefs.current)
      messagesEndRefs.current.scrollIntoView({ behavior });
  };

  const getUsers = async () => {
    const { data, error } = await supabase
      .from('users')
      .select('id')
      .eq('room_id', room.id);

    if (error) {
      console.log('Error ao buscar usuarios');
    }

    // if (data && data.length > 0) {
    //   setUsersIds(data.map((user) => user.id));
    // }
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
          console.log('new message');
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(messagesListener);
    };
  }, []);

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

  return (
    <RoomContext.Provider
      value={{
        videoUrl,
        playing,
        videoTime,
        sendPlay,
        sendPause,
        kingRoomId,
        isKing,
        setPlaying,
        setVideoTime,
        isLoadingMessages,
        messages,
        users,
        isFirstRender,
      }}
    >
      {children}
    </RoomContext.Provider>
  );
};
