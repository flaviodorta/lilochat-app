// useEffect(() => {
//   // Listener para sincronizar as mudanças no vídeo em tempo real
//   const syncListener = supabase
//     .channel('room-updates-channel')
//     .on(
//       'postgres_changes',
//       {
//         event: 'UPDATE',
//         schema: 'public',
//         table: 'rooms',
//         filter: `id=eq.${room.id}`,
//       },
//       (payload: any) => {
//         console.log(payload);
//         setPlaying(payload.new.video_is_playing);
//         setVideoTime(payload.new.video_time);
//         setVideoUrl(payload.new.video_url);

//         // Usar seekTo() para ajustar o tempo do vídeo
//         if (playerRef.current) {
//           playerRef.current.seekTo(payload.new.video_time, 'seconds');
//         }
//       }
//     )
//     .subscribe();

//   return () => {
//     supabase.removeChannel(syncListener);
//   };
// }, [room.id, supabase]);

// const handlePlay = async () => {
//   setPlaying(true);
//   // Atualizar o estado do vídeo no banco
//   await supabase
//     .from('rooms')
//     .update({ video_is_playing: true })
//     .eq('id', room.id);
// };

// const handlePause = async () => {
//   setPlaying(false);
//   const currentTime = playerRef.current
//     ? playerRef.current.getCurrentTime()
//     : 0;

//   // Atualizar o estado do vídeo e tempo no banco
//   const { error, data } = await supabase
//     .from('rooms')
//     .update({ video_is_playing: false, video_time: currentTime })
//     .eq('id', room.id);
// };

// const handleSeek = async (time: number) => {
//   console.log('seek to', time);
//   // Atualizar o tempo de reprodução no banco
//   const { data, error } = await supabase
//     .from('rooms')
//     .update({ video_time: time })
//     .eq('id', room.id);
//   console.log(data);
//   console.log(error);
// };
