'use client';

import { useState, useEffect, useRef } from 'react';
import ReactPlayer from 'react-player';
import supabaseCreateClient from '@/utils/supabase/supabase-client';
import { Room } from '@/types/rooms';

type Props = {
  userId: string;
  room: Room;
};

const RoomPlayer = ({ room, userId }: Props) => {
  const [messages, setMessages] = useState<string[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [videoUrl, setVideoUrl] = useState(room.video_url);
  const [playing, setPlaying] = useState(room.video_is_playing);
  const [videoTime, setVideoTime] = useState(room.video_time);
  const supabase = supabaseCreateClient();
  const playerRef = useRef<ReactPlayer>(null); // Referência ao player

  useEffect(() => {
    // Listener para sincronizar as mudanças no vídeo em tempo real
    const syncListener = supabase
      .channel('room-updates-channel')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'rooms',
          filter: `id=eq.${room.id}`,
          // columns: ['video_time']
        },
        (payload: any) => {
          console.log(payload);
          setPlaying(payload.new.video_is_playing);
          setVideoTime(payload.new.video_time);
          setVideoUrl(payload.new.video_url);

          // Usar seekTo() para ajustar o tempo do vídeo
          if (playerRef.current) {
            playerRef.current.seekTo(payload.new.video_time, 'seconds');
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(syncListener);
    };
  }, [room.id, supabase]);

  const handlePlay = async () => {
    setPlaying(true);
    // Atualizar o estado do vídeo no banco
    await supabase
      .from('rooms')
      .update({ video_is_playing: true })
      .eq('id', room.id);
  };

  const handlePause = async () => {
    setPlaying(false);
    const currentTime = playerRef.current
      ? playerRef.current.getCurrentTime()
      : 0;
    console.log('pause at', currentTime);

    // Atualizar o estado do vídeo e tempo no banco
    const { error, data } = await supabase
      .from('rooms')
      .update({ video_is_playing: false, video_time: currentTime })
      .eq('id', room.id);
    console.log(error);
    console.log(data);
  };

  const handleSeek = async (time: number) => {
    console.log('seek to', time);
    // Atualizar o tempo de reprodução no banco
    const { data, error } = await supabase
      .from('rooms')
      .update({ video_time: time })
      .eq('id', room.id);
    console.log(data);
    console.log(error);
  };

  return (
    <div className='w-full h-full flex items-center justify-center relative bg-neutral-50'>
      <ReactPlayer
        ref={playerRef} // Referência ao player para controlar o tempo
        playing={playing}
        url={videoUrl}
        onPlay={handlePlay}
        onPause={handlePause}
        onSeek={handleSeek}
        onProgress={({ playedSeconds }) => setVideoTime(playedSeconds)} // Atualiza o tempo conforme o progresso
        width={'100%'}
        height={'100%'}
      />
    </div>
  );
};

export default RoomPlayer;
