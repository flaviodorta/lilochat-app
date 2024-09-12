if (isKingRoom) {
  console.log('here 1');
  const { data: usersInRoom, error: usersInRoomError } = await supabase
    .from('users')
    .select('id')
    .eq('room_id', room.id);

  if (usersInRoomError) {
    console.log('Error ao buscar usuarios da sala', usersInRoomError);
    return;
  }

  console.log('testando', usersInRoom.length);

  if (usersInRoom && usersInRoom.length > 0) {
    const randomUserIndex = Math.floor(Math.random() * usersInRoom.length);

    // console.log('users in room', usersInRoom);
    // const newUsersInRoom = usersInRoom.filter(
    //   (user) => user.id !== userId
    // );

    console.log('users in rooms', usersInRoom);

    const newKingRoom = usersInRoom[randomUserIndex];
    // console.log('new king room id', newKingRoom.id);

    const { error: updateKingRoomError } = await supabase
      .from('rooms')
      .update({ user_id: newKingRoom.id })
      .eq('id', room.id);

    if (updateKingRoomError) {
      console.log('Erro ao atualizar o dono da sala:', updateKingRoomError);
    } else {
      console.log('Novo dono da sala definido:', newKingRoom.id);
      setKingId(newKingRoom.id);
    }
  } else {
    console.log('Nenhum usuário restante na sala.');
  }
}
if (isKingRoom) {
  console.log('here 1');
  const { data: usersInRoom, error: usersInRoomError } = await supabase
    .from('users')
    .select('id')
    .eq('room_id', room.id);

  if (usersInRoomError) {
    console.log('Error ao buscar usuarios da sala', usersInRoomError);
    return;
  }

  console.log('testando', usersInRoom.length);

  if (usersInRoom && usersInRoom.length > 0) {
    const randomUserIndex = Math.floor(Math.random() * usersInRoom.length);

    // console.log('users in room', usersInRoom);
    // const newUsersInRoom = usersInRoom.filter(
    //   (user) => user.id !== userId
    // );

    console.log('users in rooms', usersInRoom);

    const newKingRoom = usersInRoom[randomUserIndex];
    // console.log('new king room id', newKingRoom.id);

    const { error: updateKingRoomError } = await supabase
      .from('rooms')
      .update({ user_id: newKingRoom.id })
      .eq('id', room.id);

    if (updateKingRoomError) {
      console.log('Erro ao atualizar o dono da sala:', updateKingRoomError);
    } else {
      console.log('Novo dono da sala definido:', newKingRoom.id);
      setKingId(newKingRoom.id);
    }
  } else {
    console.log('Nenhum usuário restante na sala.');
  }
}
