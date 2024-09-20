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
  const {
    kingRoomId,
    playing,
    videoUrl,
    videos,
    setVideoUrl,
    setPlayerRef,
    setPlaying,
  } = useRoomStore((state) => state);
  const { channel } = useChannel();

  const playerRef = useRef<ReactPlayer>(null);

  const isMount = useMountEffect();
  const isKingRoom = kingRoomId === user.id;

  useEffect(() => {
    setVideoUrl(room.video_url);
  }, [room.video_url, setVideoUrl]);

  useEffect(() => {
    if (playerRef.current) {
      setPlayerRef(playerRef.current);
    }

    return () => {
      setPlayerRef(null);
    };
  }, [playerRef.current, setPlayerRef]);

  const sendPlay = () => {
    if (!channel || !playerRef.current) return;

    if (isKingRoom) {
      setTimeout(() => {
        setPlaying(true);
        const currentTime = playerRef.current?.getCurrentTime() || 0;
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
        console.log('send play member');

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

  const supabase = supabaseCreateClient();

  const handleVideoEnded = async () => {
    if (!isKingRoom) return;

    console.log('video ended');

    const currentIndex = videos.findIndex(
      (video) => video.video_url === videoUrl
    );
    const nextIndex = (currentIndex + 1) % videos.length;
    const nextVideo = videos[nextIndex];

    setVideoUrl(nextVideo.video_url);

    const { error } = await supabase
      .from('rooms')
      .update({
        video_url: nextVideo.video_url,
        video_thumbnail_url: nextVideo.thumbnail_url,
      })
      .eq('id', room.id);

    if (error) {
      console.log('Error at update video_url');
    }

    channel?.send({
      type: 'broadcast',
      event: 'change-video',
      payload: {
        videoUrl: nextVideo.video_url,
      },
    });
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

  if (!isMount && !playerRef.current) return null;

  return (
    <div className='group w-full cursor-pointer h-full flex items-center justify-center relative bg-neutral-50'>
      <ReactPlayer
        ref={playerRef}
        playing={playing}
        url={videoUrl}
        muted={false}
        width={'100%'}
        height={'100%'}
        onEnded={() => {
          handleVideoEnded();
        }}
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
