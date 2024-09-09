'use client';

import { useState, useEffect, useRef } from 'react';
import ReactPlayer from 'react-player';
import supabaseCreateClient from '@/utils/supabase/supabase-client';
import { User } from '@/types/user';

type Props = {
  roomId: string;
  userId: string;
};

const Room = ({ roomId, userId }: Props) => {
  const [playing, setPlaying] = useState(false);
  const [videoTime, setVideoTime] = useState(0);
  const [users, setUsers] = useState<User[]>([]);
  const playerRef = useRef<ReactPlayer>(null!);
  const supabase = supabaseCreateClient();

  const syncVideo = async (playing: boolean, time: number) => {
    await supabase
      .from('rooms')
      .update({
        video_is_playing: playing,
        video_time: time,
      })
      .eq('id', roomId);
  };

  const getUsersRoom = async () => {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('roomId', roomId);

    if (error) {
      console.error('Error ao buscar usuários', error);
    } else {
      setUsers(data);
    }
  };

  useEffect(() => {
    const syncListener = supabase
      .channel('video-room-channel')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'PUBLIC',
          table: 'rooms',
          filter: `id=eq.${roomId}`,
        },
        (payload: any) => {
          setPlaying(payload.new.video_is_playing);
          playerRef.current.seekTo(payload.new.video_time, 'seconds');
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(syncListener);
    };
  }, [supabase, roomId]);

  useEffect(() => {
    const userListenter = supabase
      .channel('users-room-channel')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'users',
          filter: `room_id=eq.${roomId}`,
        },
        (payload: any) => {
          setUsers((prevUsers) => [...prevUsers, payload.new]);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'users',
          filter: `room_id=eq.${roomId}`,
        },
        (payload: any) => {
          if (payload.old.room_id === roomId && payload.new.roomId !== roomId) {
            setUsers((prevUsers) =>
              prevUsers.filter((user) => user.id !== payload.old.id)
            );
          }
        }
      )
      .subscribe();
  });
};
