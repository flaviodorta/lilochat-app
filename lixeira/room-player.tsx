// @ts-nocheck

'use client';

import { useState, useEffect } from 'react';
import supabaseCreateClient from '@/lib/supabaseClient';
import VideoPlayer from './VideoPlayer';

const RoomSync = ({ roomId, userId }) => {
  const [messages, setMessages] = useState<string[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [playing, setPlaying] = useState(false);
  const [videoTime, setVideoTime] = useState(0);
  const supabase = supabaseCreateClient();

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
          filter: `id=eq.${roomId}`,
        },
        (payload) => {
          setPlaying(payload.new.video_is_playing);
          setVideoTime(payload.new.video_time);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(syncListener);
    };
  }, [roomId]);

  const handleSendMessage = async () => {
    if (newMessage.trim() === '') return;
    // Lógica para enviar a mensagem ao banco
    const { data, error } = await supabase
      .from('messages')
      .insert([{ room_id: roomId, user_id: userId, content: newMessage }]);

    if (error) {
      console.error('Erro ao enviar mensagem:', error);
    } else {
      setNewMessage('');
    }
  };

  const handlePlay = () => {
    setPlaying(true);
    // Atualizar o estado do vídeo no banco
    supabase.from('rooms').update({ video_is_playing: true }).eq('id', roomId);
  };

  const handlePause = () => {
    setPlaying(false);
    // Atualizar o estado do vídeo no banco
    supabase.from('rooms').update({ video_is_playing: false }).eq('id', roomId);
  };

  const handleSeek = (time) => {
    setVideoTime(time);
    // Atualizar o tempo de reprodução no banco
    supabase.from('rooms').update({ video_time: time }).eq('id', roomId);
  };

  return (
    <div>
      {/* Componente VideoPlayer */}
      <VideoPlayer
        playing={playing}
        videoTime={videoTime}
        onPlay={handlePlay}
        onPause={handlePause}
        onSeek={handleSeek}
      />

      {/* Exibindo as mensagens */}
      <div>
        {messages.map((message, index) => (
          <div key={index}>{message}</div>
        ))}
      </div>

      {/* Input para enviar novas mensagens */}
      <input
        type='text'
        value={newMessage}
        onChange={(e) => setNewMessage(e.target.value)}
      />
      <button onClick={handleSendMessage}>Enviar Mensagem</button>
    </div>
  );
};

export default RoomSync;
