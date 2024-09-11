'use client';

import { useState, useEffect, useRef } from 'react';
import ReactPlayer from 'react-player';
import supabaseCreateClient from '@/utils/supabase/supabase-client';
import { Room } from '@/types/rooms';
import { useMountEffect } from '@/hooks/use-mount-effect';
import { RealtimeChannel } from '@supabase/supabase-js';

type Props = {
  userId: string;
  room: Room;
};

const RoomPlayer = ({ room, userId }: Props) => {
  const [videoUrl, setVideoUrl] = useState(room.video_url);
  const [playing, setPlaying] = useState(true);
  const [videoTime, setVideoTime] = useState(room.video_time);
  const supabase = supabaseCreateClient();
  const playerRef = useRef<ReactPlayer>(null); // Referência ao player
  const r = useRef<HTMLDivElement>(null!);
  const isMount = useMountEffect();
  const [channel, setChannel] = useState<RealtimeChannel | null>(null);

  r.current?.click();

  useEffect(() => {
    console.log('playing state change', playing);
  }, [playing]);

  console.log('progress', videoTime);

  const roomOne = supabase.channel(`room_${room.id}`);

  roomOne
    .on(
      'broadcast',
      {
        event: 'video-status',
      },
      (state) => {
        setPlaying(state.payload.playing);
        setVideoTime(state.payload.time);
        playerRef.current?.seekTo(state.payload.time);
        console.log('Broadcast received:', state.payload);
      }
    )
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        setChannel(roomOne);
      }
    });

  useEffect(() => {
    return () => {
      supabase.removeChannel(roomOne);
    };
  }, [room, supabase]);

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
      className='w-full h-full flex items-center justify-center relative bg-neutral-50'
    >
      <ReactPlayer
        ref={playerRef}
        playing={playing}
        url={videoUrl}
        // onPlay={sendPlay}
        // onPause={sendPause}
        onProgress={({ playedSeconds }) => setVideoTime(playedSeconds)}
        width={'100%'}
        height={'100%'}
        controls={false}
      />
      <div
        className='absolute bg-red-600/10 left-0 top-0 w-full h-full'
        onClick={() => {
          if (playing) sendPause();
          else sendPlay();
        }}
      >
        click
      </div>
    </div>
  );
};

export default RoomPlayer;
