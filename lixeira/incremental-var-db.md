SELECT MIN(id + 1) AS next_id
FROM your_table
WHERE id + 1 NOT IN (SELECT id FROM your_table);

const getNextAvailableId = async () => {
const { data, error } = await supabase
.rpc('get_next_available_id'); // Chama a função criada no banco

if (error) {
console.error('Erro ao buscar o próximo ID disponível:', error);
return null;
}

return data ? data[0].next_id : null;
};

CREATE OR REPLACE FUNCTION get_next_available_id()
RETURNS TABLE(next_id bigint)
LANGUAGE sql
AS $$
SELECT MIN(id + 1) AS next_id
FROM your_table
WHERE id + 1 NOT IN (SELECT id FROM your_table);

$$
;


const insertNewRecord = async (roomId: string, userId: string) => {
  const nextId = await getNextAvailableId();

  if (!nextId) {
    console.error('Nenhum próximo ID disponível');
    return;
  }

  const { data, error } = await supabase
    .from('your_table')
    .insert({
      id: nextId, // Usando o próximo ID disponível
      room_id: roomId,
      user_id: userId,
    });

  if (error) {
    console.error('Erro ao inserir novo registro:', error);
  } else {
    console.log('Novo registro criado com o ID:', nextId);
  }
};
$$
