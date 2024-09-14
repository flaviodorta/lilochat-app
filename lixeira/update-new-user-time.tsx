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
  const [playing, setPlaying] = useState(true); // Estado de playing do usuário local
  const [videoTime, setVideoTime] = useState(room.video_time); // Tempo atual
  const [ownerTime, setOwnerTime] = useState(room.video_time); // Tempo controlado pelo dono da sala
  const supabase = supabaseCreateClient();
  const playerRef = useRef<ReactPlayer>(null);
  const isMount = useMountEffect();
  const [channel, setChannel] = useState<RealtimeChannel | null>(null);

  const isOwner = userId === room.user_id; // Verifica se o usuário é o dono da sala

  useEffect(() => {
    const roomOne = supabase.channel(`room_${room.id}`);

    // Recebe atualizações do dono da sala sobre o estado do vídeo
    roomOne
      .on(
        'broadcast',
        {
          event: 'video-status',
        },
        async (state) => {
          if (state.payload.requestForTime && isOwner) {
            // Se for o dono e alguém pediu o tempo, responder apenas para o usuário que pediu
            const currentTime = playerRef.current?.getCurrentTime() || 0;
            const requesterId = state.payload.requesterId;

            // Enviar o tempo atual diretamente para o usuário que pediu
            channel?.send({
              type: 'broadcast',
              event: 'video-time-response',
              payload: { playing, time: currentTime, userId: requesterId },
            });
          }

          // Se a mensagem for uma resposta de tempo para o usuário
          if (state.payload.userId === userId && !isOwner) {
            // Atualiza o tempo do vídeo controlado pelo dono da sala
            setOwnerTime(state.payload.time);
            setPlaying(state.payload.playing);
            playerRef.current?.seekTo(state.payload.time); // Sincroniza o tempo
          }
        }
      )
      .on('presence', { event: 'join' }, async ({ newPresences }) => {
        console.log('Novo usuário entrou:', newPresences);

        // Se o usuário atual é o dono da sala, envia o tempo atual para o novo usuário
        if (isOwner && playerRef.current) {
          const currentTime = playerRef.current.getCurrentTime();

          // Enviar o tempo atual para sincronizar o novo usuário
          channel?.send({
            type: 'broadcast',
            event: 'video-status',
            payload: { playing, time: currentTime },
          });
        }
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setChannel(roomOne);
        }
      });

    return () => {
      supabase.removeChannel(roomOne);
    };
  }, [room.id, supabase, isOwner, playing]);

  // Função chamada por usuários não-donos para pedir o tempo do dono da sala
  const requestSyncWithOwner = () => {
    if (!isOwner) {
      channel?.send({
        type: 'broadcast',
        event: 'video-status',
        payload: { requestForTime: true, requesterId: userId }, // Pedido de tempo
      });
    }
  };

  const sendPlay = () => {
    if (!channel || !isOwner) return;
    const currentTime = playerRef.current?.getCurrentTime() || 0;
    channel.send({
      type: 'broadcast',
      event: 'video-status',
      payload: { playing: true, time: currentTime },
    });
  };

  const sendPause = () => {
    if (!channel || !isOwner) return;
    const currentTime = playerRef.current?.getCurrentTime() || 0;
    channel.send({
      type: 'broadcast',
      event: 'video-status',
      payload: { playing: false, time: currentTime },
    });
  };

  // Função para o play de quem não é dono da sala: pede o tempo do dono e sincroniza
  const handlePlayForNonOwner = () => {
    if (!isOwner) {
      requestSyncWithOwner(); // Pede o tempo do dono
      setPlaying(true); // Dá play localmente após sincronização
    }
  };

  if (!isMount) return null;

  return (
    <div className='w-full h-full flex items-center justify-center relative bg-neutral-50'>
      <ReactPlayer
        ref={playerRef}
        playing={playing}
        url={videoUrl}
        onProgress={({ playedSeconds }) => {
          if (isOwner) {
            setVideoTime(playedSeconds); // O dono atualiza o tempo
          }
        }}
        width='100%'
        height='100%'
        controls={true}
      />

      {/* Se for dono da sala, envia os eventos de Play e Pause */}
      {isOwner ? (
        <div
          className='absolute bg-red-600/10 left-0 top-0 w-full h-full'
          onClick={() => {
            if (playing) sendPause();
            else sendPlay();
          }}
        >
          Click to {playing ? 'Pause' : 'Play'}
        </div>
      ) : (
        // Se for usuário não dono, só pausa e pede sincronização ao dar play
        <div
          className='absolute bg-red-600/10 left-0 top-0 w-full h-full'
          onClick={() => {
            if (playing) setPlaying(false); // Apenas pausa localmente
            else handlePlayForNonOwner(); // Pede sincronização ao dar play
          }}
        >
          Click to {playing ? 'Pause' : 'Play'}
        </div>
      )}
    </div>
  );
};

export default RoomPlayer;
