'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from 'react';
import supabaseCreateClient from '@/utils/supabase/supabase-client';
import { RealtimeChannel } from '@supabase/supabase-js';
import { useRoomStore } from '@/providers/room-provider';
import { User } from '@/types/user';
import { Room } from '@/types/rooms';

interface ChannelProviderProps {
  room: Room;
  user: User;
  children: ReactNode;
}

interface ChannelContextValue {
  channel: RealtimeChannel | null;
}

const ChannelContext = createContext<ChannelContextValue | null>(null);

export const ChannelProvider = ({
  room,
  user,
  children,
}: ChannelProviderProps) => {
  const supabase = supabaseCreateClient();
  const {
    setUsers,
    setKingRoomId,
    addUser,
    removeUser,
    kingRoomId,
    playerRef,
    playing,
    setPlaying,
    videoUrl,
    setVideoUrl,
  } = useRoomStore((state) => state);

  const isKingRoom = kingRoomId === user.id;
  console.log('is king room', isKingRoom);

  const [channel, setChannel] = useState<RealtimeChannel>(
    supabase.channel(`room_${room.id}`, {
      config: {
        presence: {
          key: 'users',
        },
      },
    })
  );

  useEffect(() => {
    if (!playerRef || !channel) return;

    channel
      .on('presence', { event: 'join' }, ({ key, newPresences }) => {
        addUser({
          user_id: newPresences[0].user_id,
          nickname: newPresences[0].nickname,
          online_at: newPresences[0].online_at,
        });

        if (isKingRoom) {
          const newUserId = newPresences[0]?.user_id;
          const currentTime = playerRef.getCurrentTime() || 0;

          if (newUserId) {
            channel.send({
              type: 'broadcast',
              event: 'join-video-status',
              payload: {
                playing: playing,
                time: currentTime,
                user_id: newUserId,
              },
            });
          }
        }
      })
      .on(
        'broadcast',
        {
          event: 'member-video-status',
        },
        (state) => {
          if (isKingRoom) {
            setPlaying(state.payload.playing);
            const currentTime = playerRef.getCurrentTime();
            channel.send({
              type: 'broadcast',
              event: 'king-video-status',
              payload: {
                playing: state.payload.playing,
                time: currentTime,
              },
            });
          }
        }
      );
  }, [channel, playerRef, kingRoomId]);

  useEffect(() => {
    if (!playerRef || !channel) return;

    const userStatus = {
      user_id: user.id,
      nickname: user.nickname,
      online_at: new Date().toISOString(),
    };

    channel
      .on('presence', { event: 'sync' }, () => {
        const newPresenceState = channel.presenceState();
        const updatedUsers = Array.isArray(newPresenceState.users)
          ? newPresenceState.users.map((user) => ({
              // @ts-ignore
              user_id: user.user_id,
              // @ts-ignore
              nickname: user.nickname,
              // @ts-ignore
              online_at: user.online_at,
            }))
          : [];
        const sortByTime = updatedUsers
          .filter((user) => user && user.user_id)
          .sort((a, b) => {
            if (a.online_at === b.online_at) {
              // Em caso de empate no horário, ordene pelo user_id
              return a.user_id.localeCompare(b.user_id);
            }
            return (
              new Date(a.online_at).getTime() - new Date(b.online_at).getTime()
            );
          });

        setKingRoomId(sortByTime.length > 0 ? sortByTime[0].user_id : '');

        setUsers(sortByTime);
      })
      .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
        // @ts-ignore
        removeUser(leftPresences.user_id);
      })
      .on(
        'broadcast',
        {
          event: 'king-video-status',
        },
        (state) => {
          setPlaying(state.payload.playing);
          playerRef.seekTo(state.payload.time);
        }
      )
      .on(
        'broadcast',
        {
          event: 'join-video-status',
        },
        (state) => {
          if (state.payload.user_id === user.id) {
            playerRef.seekTo(state.payload.time, 'seconds');
            setPlaying(state.payload.playing);
          }
        }
      )
      .on(
        'broadcast',
        {
          event: 'change-video',
        },
        (state) => {
          console.log('change video on');
          setVideoUrl(state.payload.videoUrl);
        }
      )
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track(userStatus);
          if (!channel) setChannel(channel);
        }
      });

    return () => {
      channel.untrack().then(() => {
        channel.unsubscribe();
      });
    };
  }, [playerRef, channel]);

  return (
    <ChannelContext.Provider value={{ channel }}>
      {children}
    </ChannelContext.Provider>
  );
};

export const useChannel = () => {
  const context = useContext(ChannelContext);
  if (!context) {
    throw new Error('useChannel must be used within a ChannelProvider');
  }
  return context;
};
