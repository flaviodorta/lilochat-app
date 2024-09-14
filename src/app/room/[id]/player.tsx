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
import { useChannel } from '@/providers/channel-provider';

type Props = {
  user: User;
  room: Room;
};

const Player = ({ room, user }: Props) => {
  const { kingRoomId } = useRoomStore((state) => state);
  const { channel } = useChannel();

  const [videoUrl, setVideoUrl] = useState(room.video_url);
  const [playing, setPlaying] = useState(false);
  const [videoTime, setVideoTime] = useState(0);
  const supabase = supabaseCreateClient();
  const playerRef = useRef<ReactPlayer>(null);
  // const r = useRef<HTMLDivElement>(null!);
  const isMount = useMountEffect();
  const isKingRoom = kingRoomId === user.id;
  const initDateRef = useRef(new Date());

  // const userStatus = {
  //   user_id: user.id,
  //   playing,
  //   videoTime,
  // };

  useEffect(() => {
    console.log('playing state change', playing);
  }, [playing]);

  useEffect(() => {
    if (!channel) return;

    channel
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
      .on(
        'broadcast',
        {
          event: 'join-video-status',
        },
        (state) => {
          if (state.payload.user_id === user.id) {
            console.log('recevied');
            console.log('here');
            console.log('state play', state.payload.playing);
            console.log('playing', playing);
            setPlaying(state.payload.playing);
            setVideoTime(state.payload.time);
            playerRef.current?.seekTo(state.payload.time);
          }
        }
      )
      .on('presence', { event: 'join' }, ({ key, newPresences }) => {
        console.log('here');
        if (isKingRoom) {
          const newUserId = newPresences[0]?.user_id;
          console.log('new user', newUserId);

          if (newUserId) {
            channel.send({
              type: 'broadcast',
              event: 'join-video-status',
              payload: {
                playing: playing,
                time: playerRef.current?.getCurrentTime() || videoTime,
                user_id: newUserId, // Identifica o novo usuário
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

    setTimeout(() => {
      setPlaying(true);
      const currentTime = playerRef.current?.getCurrentTime() || 0;
      channel.send({
        type: 'broadcast',
        event: 'video-status',
        payload: {
          playing: true,
          time: currentTime,
        },
      });
    }, 600);
  };

  const sendPause = () => {
    if (!channel) return;

    setTimeout(() => {
      setPlaying(false);
      const currentTime = playerRef.current?.getCurrentTime() || 0;
      channel.send({
        type: 'broadcast',
        event: 'video-status',
        payload: {
          playing: false,
          time: currentTime,
        },
      });
    }, 600);
  };

  if (!isMount) return null;

  return (
    <div
      // ref={r}
      className={cn([
        'group w-full h-full flex items-center justify-center relative bg-neutral-50',
        isKingRoom && 'cursor-pointer',
      ])}
    >
      <ReactPlayer
        ref={playerRef}
        playing={playing}
        url={videoUrl}
        onReady={handleReady}
        muted={true} // Garantir que o vídeo seja reproduzido automaticamente
        onProgress={(state) => {
          console.log('played time', state);
          setVideoTime(state.playedSeconds);
        }}
        onBufferEnd={() => {}}
        width={'100%'}
        height={'100%'}
        controls={true}
      />
      <div
        className={cn(
          [
            'absolute flex items-center justify-center bg-red-600/0 left-0 top-0 w-full h-full',
          ],
          isKingRoom && 'h-3/4'
        )}
        onClick={() => {
          if (kingRoomId === user.id) {
            if (playing) sendPause();
            else sendPlay();
          } else {
            // if (playing) {
            //   setPlaying(false);
            //   initDateRef.current = new Date();
            // } else {
            //   setPlaying(true);
            //   // playerRef.current?.seekTo(
            //   //   videoTime +
            //   //     (new Date().getTime() - initDateRef.current.getTime()) / 1000
            //   // );
            //   channel?.send({
            //     type: 'broadcast',
            //     event: 'sync-video-status',
            //     payload: { user_id: user.id },
            //   });
            // }
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
