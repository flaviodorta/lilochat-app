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
  const { setUsers, setKingRoomId, addUser, removeUser } = useRoomStore(
    (state) => state
  );

  const supabseChannel = supabase.channel(`room_${room.id}`, {
    config: {
      presence: {
        key: 'users',
      },
    },
  });

  const [channel, setChannel] = useState<RealtimeChannel>(supabseChannel);

  useEffect(() => {
    const userStatus = {
      user_id: user.id,
      nickname: user.nickname,
      online_at: new Date().toISOString(),
    };

    const channel = supabase.channel(`room_${room.id}`, {
      config: {
        presence: {
          key: 'users',
        },
      },
    });

    const presenceChannel = channel
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
          .sort((a, b) => a.online_at - b.online_at);
        console.log(newPresenceState);

        setKingRoomId(sortByTime.length > 0 ? sortByTime[0].user_id : '');

        setUsers(sortByTime);
      })
      .on('presence', { event: 'join' }, ({ key, newPresences }) => {
        addUser({
          user_id: newPresences[0].user_id,
          nickname: newPresences[0].nickname,
          online_at: newPresences[0].online_at,
        });
      })
      .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
        // @ts-ignore
        removeUser(leftPresences.user_id);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          const presenceTrackStatus = await channel.track(userStatus);
          setChannel(channel);
        }
      });

    // setChannel(presenceChannel);
    return () => {
      channel.untrack().then(() => {
        channel.unsubscribe();
      });
    };
  }, []);

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
