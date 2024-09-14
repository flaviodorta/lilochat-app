'use client';

import { useState, useEffect, useRef } from 'react';
import ReactPlayer from 'react-player';
import supabaseCreateClient from '@/utils/supabase/supabase-client';
import { Room } from '@/types/rooms';
import { useMountEffect } from '@/hooks/use-mount-effect';
import { RealtimeChannel } from '@supabase/supabase-js';
import { FaPause, FaPlay } from 'react-icons/fa6';
import { User } from '@/types/user';
import { useRoomStore } from '@/providers/room-provider';
import { cn } from '@/utils/cn';

type Props = {
  user: User;
  room: Room;
};

const Player = ({ room, user }: Props) => {
  const { kingRoomId } = useRoomStore((state) => state);

  const [videoUrl, setVideoUrl] = useState(room.video_url);
  const [playing, setPlaying] = useState(true);
  const [videoTime, setVideoTime] = useState(room.video_time);
  const supabase = supabaseCreateClient();
  const playerRef = useRef<ReactPlayer>(null);
  const r = useRef<HTMLDivElement>(null!);
  const isMount = useMountEffect();
  const [channel, setChannel] = useState<RealtimeChannel | null>(null);

  const isKingRoom = kingRoomId === user.id;

  const userStatus = {
    user_id: user.id,
    playing,
    videoTime,
  };

  // useEffect(() => {
  //   const channel = supabase.channel('player', {
  //     config: {
  //       presence: {
  //         key: 'users',
  //       },
  //     },
  //   });
  //   console.log('king room id fora', kingRoomId);
  //   channel
  //     .on('presence', { event: 'sync' }, () => {
  //       const newPresenceState = channel.presenceState();
  //       console.log('new presence state', newPresenceState);
  //       console.log('king room id', kingRoomId);
  //       const kingRoomState = Array.isArray(newPresenceState.users)
  //         ? newPresenceState.users.filter(
  //             (userState) => userState.user_id === kingRoomId
  //           )[0]
  //         : [];
  //       console.log('king room state', kingRoomState);
  //     })
  //     .on('presence', { event: 'join' }, ({ key, newPresences }) => {
  //       console.log('new presences', newPresences);
  //     })
  //     .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
  //       // @ts-ignore
  //     })
  //     .subscribe(async (status) => {
  //       if (status === 'SUBSCRIBED') {
  //         const presenceTrackStatus = await channel.track(userStatus);
  //       }
  //     });

  //   return () => {
  //     channel.untrack().then(() => {
  //       channel.unsubscribe();
  //     });
  //   };
  // }, []);

  useEffect(() => {
    // console.log('playing state change', playing);
  }, [playing]);

  // const playerChannel = supabase.channel(`player_${room.id}`);

  // playerChannel
  //   .on(
  //     'broadcast',
  //     {
  //       event: 'video-status',
  //     },
  //     (state) => {
  //       setPlaying(state.payload.playing);
  //       setVideoTime(state.payload.time);
  //       playerRef.current?.seekTo(state.payload.time);
  //     }
  //   )
  //   .subscribe((status) => {
  //     if (status === 'SUBSCRIBED') {
  //       setChannel(playerChannel);
  //     }
  //   });

  // useEffect(() => {
  //   return () => {
  //     supabase.removeChannel(playerChannel);
  //   };
  // }, [room, supabase]);

  const sendPlay = () => {
    if (!channel) return;
    setPlaying(true);
    channel.send({
      type: 'broadcast',
      event: 'video-status',
      payload: { playing: true, time: videoTime },
    });
  };

  const sendPause = () => {
    if (!channel) return;
    setPlaying(false);
    channel.send({
      type: 'broadcast',
      event: 'video-status',
      payload: { playing: false, time: videoTime },
    });
  };

  if (!isMount) return null;

  return (
    <div
      ref={r}
      className={cn([
        'group w-full h-full flex items-center justify-center relative bg-neutral-50',
        isKingRoom && 'cursor-pointer',
      ])}
    >
      <ReactPlayer
        ref={playerRef}
        playing={playing}
        url={videoUrl}
        // onPlay={sendPlay}
        // onPause={sendPause}
        // onBuffer={}
        onProgress={({ playedSeconds }) => setVideoTime(playedSeconds)}
        width={'100%'}
        height={'100%'}
        controls={false}
      />
      <div
        className='absolute flex items-center justify-center bg-red-600/0 left-0 top-0 w-full h-full'
        onClick={() => {
          if (kingRoomId === user.id) {
            if (playing) sendPause();
            else sendPlay();
          }
        }}
      >
        <span className='group-hover:block hidden text-6xl text-black/80'>
          {!isKingRoom ? null : playing ? <FaPause /> : <FaPlay />}
        </span>
      </div>
    </div>
  );
};

export default Player;
