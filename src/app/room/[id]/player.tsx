'use client';

import { useState, useEffect, useRef } from 'react';
import ReactPlayer from 'react-player';
import supabaseCreateClient from '@/utils/supabase/supabase-client';
import { Room } from '@/types/rooms';
import { useMountEffect } from '@/hooks/use-mount-effect';
import { RealtimeChannel } from '@supabase/supabase-js';
import { FaPause, FaPlay } from 'react-icons/fa6';

type Props = {
  userId: string;
  room: Room;
};

const RoomPlayer = ({ room, userId }: Props) => {
  const [videoUrl, setVideoUrl] = useState(room.video_url);
  const [playing, setPlaying] = useState(true);
  const [videoTime, setVideoTime] = useState(room.video_time);
  const supabase = supabaseCreateClient();
  const playerRef = useRef<ReactPlayer>(null);
  const r = useRef<HTMLDivElement>(null!);
  const isMount = useMountEffect();
  const [channel, setChannel] = useState<RealtimeChannel | null>(null);

  useEffect(() => {
    console.log('playing state change', playing);
  }, [playing]);

  // console.log('progress', videoTime);

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
      className='group cursor-pointer w-full h-full flex items-center justify-center relative bg-neutral-50'
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
        className='absolute flex items-center justify-center bg-red-600/0 left-0 top-0 w-full h-full'
        onClick={() => {
          if (playing) sendPause();
          else sendPlay();
        }}
      >
        <span className='group-hover:block hidden text-6xl text-black/80'>
          {playing ? <FaPause /> : <FaPlay />}
        </span>
      </div>
    </div>
  );
};

export default RoomPlayer;
