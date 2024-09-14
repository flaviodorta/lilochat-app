const handleJoinRoom = async (roomId: string, userId?: string) => {
  if (!userId) {
    toast({
      duration: 5000,
      title: 'Log in to account first',
      status: 'info',
    });
    return; // Certifique-se de que o usuário está logado antes de continuar
  }

  try {
    // 1. Verificar a quantidade de usuários presentes na sala usando a presença
    const roomPresenceChannel = supabase.channel(`room_${roomId}`);

    // Se inscreve para verificar o estado de presença da sala
    const { data: presenceState } = await roomPresenceChannel.track();

    const usersInRoom = Object.keys(presenceState).length;

    // Se não houver nenhum usuário presente na sala
    if (usersInRoom === 0) {
      console.log('Nenhum usuário na sala. Este usuário se tornará o dono.');

      // 2. Atualizar o user_id da sala para o usuário que está entrando
      const { error: updateError } = await supabase
        .from('room')
        .update({ user_id: userId })
        .eq('id', roomId);

      if (updateError) {
        console.error('Erro ao atualizar o user_id da sala:', updateError);
        return;
      }

      console.log('Usuário se tornou o dono da sala.');
    }

    // 3. Atualizar o room_id do usuário para associá-lo à sala
    const { error } = await supabase
      .from('users')
      .update({ room_id: roomId })
      .eq('id', userId);

    if (error) {
      console.error('Erro ao atualizar o room_id do usuário:', error);
    } else {
      console.log('Usuário entrou na sala com sucesso.');
      router.push('/room/' + roomId); // Redirecionar para a sala
    }
  } catch (error) {
    console.error('Erro inesperado ao entrar na sala:', error);
  }
};
