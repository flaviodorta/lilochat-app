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
import { useRouter } from 'next/navigation';

type Props = {
  user: User;
  room: Room;
};

const Player = ({ room, user }: Props) => {
  const { kingRoomId } = useRoomStore((state) => state);
  const { channel } = useChannel();

  const [videoUrl, setVideoUrl] = useState(room.video_url);
  const [playing, setPlaying] = useState<boolean | undefined>(false);
  const supabase = supabaseCreateClient();
  const playerRef = useRef<ReactPlayer>(null);
  const isMount = useMountEffect();
  const isKingRoom = kingRoomId === user.id;

  // const [isFirstClick, setIsFirstClick] = useState(true);

  useEffect(() => {
    if (!channel || !playerRef.current) return;

    channel
      .on(
        'broadcast',
        {
          event: 'king-video-status',
        },
        (state) => {
          setPlaying(state.payload.playing);
          playerRef.current?.seekTo(state.payload.time);
          console.log('here');
        }
      )
      .on(
        'broadcast',
        {
          event: 'member-video-status',
        },
        (state) => {
          // setPlaying(state.payload.playing);
          if (isKingRoom) {
            console.log('here king');
            setPlaying(state.payload.playing);
            const currentTime = playerRef.current!.getCurrentTime();
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
      )
      .on(
        'broadcast',
        {
          event: 'join-video-status',
        },
        (state) => {
          if (state.payload.user_id === user.id) {
            console.log('state time', state.payload.time);
            console.log('playing', state.payload.playing);
            playerRef.current?.seekTo(state.payload.time + 2, 'seconds');
            setTimeout(() => {
              setPlaying(state.payload.playing);
            }, 2000);
          }
        }
      )
      .on('presence', { event: 'join' }, ({ key, newPresences }) => {
        if (isKingRoom) {
          const newUserId = newPresences[0]?.user_id;
          console.log('new presence', newPresences);
          const currentTime = playerRef.current?.getCurrentTime() || 0;

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
      });
  }, [room, supabase, channel, playerRef.current]);

  const sendPlay = () => {
    if (!channel || !playerRef.current) return;

    if (isKingRoom) {
      setTimeout(() => {
        setPlaying(true);
        const currentTime = playerRef.current?.getCurrentTime() || 0;
        // setVideoTime(currentTime);
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
    if (!channel || !playerRef.current) return;

    if (isKingRoom) {
      setTimeout(() => {
        setPlaying(false);
        const currentTime = playerRef.current?.getCurrentTime() || 0;
        channel.send({
          type: 'broadcast',
          event: 'king-video-status',
          payload: {
            playing: false,
            time: currentTime,
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

  // useEffect(() => {
  //   if (playerRef.current) if (playing) playerRef.current.forceUpdate();
  // }, [playerRef.current]);
  if (!isMount && !playerRef.current) return null;

  return (
    <div className='group w-full cursor-pointer h-full flex items-center justify-center relative bg-neutral-50'>
      <ReactPlayer
        ref={playerRef}
        playing={playing}
        url={videoUrl}
        muted={false}
        width={'100%'}
        onProgress={(state) => {
          if (isKingRoom) console.log('time', state.playedSeconds);
        }}
        height={'100%'}
        controls={true}
      />
      <div
        className='absolute flex items-center justify-center bg-red-600/0 left-0 top-0 w-full h-3/4'
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
