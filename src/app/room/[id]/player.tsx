'use client';

import { useState, useEffect, useRef } from 'react';
import ReactPlayer from 'react-player';
import supabaseCreateClient from '@/utils/supabase/supabase-client';
import { Room } from '@/types/rooms';
import { useMountEffect } from '@/hooks/use-mount-effect';
import { FaPause, FaPlay } from 'react-icons/fa6';
import { User } from '@/types/user';
import { useRoomStore } from '@/providers/room-provider';
import { useChannel } from '@/providers/channel-provider';

type Props = {
  user: User;
  room: Room;
};

const Player = ({ room, user }: Props) => {
  const { kingRoomId } = useRoomStore((state) => state);
  const { channel } = useChannel();

  const [videoUrl, setVideoUrl] = useState(room.video_url);
  const [playing, setPlaying] = useState<boolean | undefined>(undefined);
  const [videoTime, setVideoTime] = useState(0);
  const supabase = supabaseCreateClient();
  const playerRef = useRef<ReactPlayer>(null!);
  const isMount = useMountEffect();
  const isKingRoom = kingRoomId === user.id;

  useEffect(() => {
    console.log('playing state change', playing);
  }, [playing]);

  useEffect(() => {
    if (!channel) return;

    channel
      .on(
        'broadcast',
        {
          event: 'king-video-status',
        },
        (state) => {
          setPlaying(state.payload.playing);
          setVideoTime(state.payload.time);
          playerRef.current?.seekTo(state.payload.time);
        }
      )
      .on(
        'broadcast',
        {
          event: 'member-video-status',
        },
        (state) => {
          setPlaying(state.payload.playing);
        }
      )
      .on(
        'broadcast',
        {
          event: 'king-to-user-video-status',
        },
        (state) => {
          setPlaying(state.payload.playing);
          setVideoTime(state.payload.time);
          playerRef.current?.seekTo(state.payload.time);
        }
      )
      .on(
        'broadcast',
        {
          event: 'join-video-status',
        },
        (state) => {
          console.log('join', state);
          if (state.payload.user_id === user.id) {
            playerRef.current.seekTo(state.payload.time, 'seconds');
            setPlaying(state.payload.playing);
          }
        }
      )
      .on('presence', { event: 'join' }, ({ key, newPresences }) => {
        if (isKingRoom) {
          const newUserId = newPresences[0]?.user_id;
          console.log('current time', videoTime);
          console.log('new presence', newPresences);
          if (newUserId) {
            channel.send({
              type: 'broadcast',
              event: 'join-video-status',
              payload: {
                playing: playing,
                time: videoTime,
                user_id: newUserId,
              },
            });
          }
        }
      });
  }, [room, supabase, channel, playing, videoTime]);

  const handleReady = () => {
    playerRef.current?.seekTo(videoTime, 'seconds');
  };

  const sendPlay = () => {
    if (!channel) return;

    if (isKingRoom) {
      setTimeout(() => {
        setPlaying(true);
        const currentTime = playerRef.current.getCurrentTime();
        channel.send({
          type: 'broadcast',
          event: 'king-video-status',
          payload: {
            playing: true,
            time: currentTime,
          },
        });
      }, 600);
    } else {
      setTimeout(() => {
        setPlaying(true);
        channel.send({
          type: 'broadcast',
          event: 'member-video-status',
          payload: {
            playing: true,
          },
        });
      }, 600);
    }
  };

  const sendPause = () => {
    if (!channel) return;

    if (isKingRoom) {
      setTimeout(() => {
        setPlaying(false);
        const currentTime = playerRef.current?.getCurrentTime();
        channel.send({
          type: 'broadcast',
          event: 'king-video-status',
          payload: {
            playing: false,
            time: videoTime,
          },
        });
      }, 600);
    } else {
      setTimeout(() => {
        setPlaying(false);
        channel.send({
          type: 'broadcast',
          event: 'member-video-status',
          payload: {
            playing: false,
          },
        });
      }, 600);
    }
  };

  console.log('playing', playing);

  if (!isMount) return null;

  return (
    <div className='group w-full cursor-pointer h-full flex items-center justify-center relative bg-neutral-50'>
      <ReactPlayer
        ref={playerRef}
        playing={playing}
        url={videoUrl}
        onReady={handleReady}
        muted={false}
        onProgress={(state) => {
          console.log('played time', state);
          if (isKingRoom) setVideoTime(state.playedSeconds);
        }}
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

export default Player;
