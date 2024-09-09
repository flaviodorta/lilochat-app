// @ts-nocheck

import { VariableSizeList as List } from 'react-window';
import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { FaUser } from 'react-icons/fa6';
import { format } from 'date-fns';
import supabaseCreateClient from '@/utils/supabase/supabase-client';
import Spinner from '@/components/spinner';

type Props = {
userId: string;
roomId: string;
};

const formatTime = (createdAt: string) => format(new Date(createdAt), 'HH:mm');

// Função para calcular a altura de cada mensagem
const calculateHeight = (index: number, messages: Message[]) => {
const baseHeight = 80; // Altura base de uma mensagem simples
const message = messages[index];
const lineHeight = 20; // Estimativa da altura de cada linha de texto
const extraHeight = Math.ceil(message.content.length / 50) \* lineHeight; // Calcula a altura extra baseado no tamanho do conteúdo
return baseHeight + extraHeight;
};

const Messages = ({ roomId, userId }: Props) => {
const [messages, setMessages] = useState<Message[]>([]);
const [newMessage, setNewMessage] = useState<string>('');
const [isLoadingMessages, setIsLoadingMessages] = useState(true);
const listRef = useRef<List>(null);
const textareaRef = useRef<HTMLTextAreaElement>(null!);
const parentRef = useRef<HTMLDivElement>(null!);

const supabase = supabaseCreateClient();

// Carrega mensagens do Supabase
const loadMoreMessages = async () => {
const { data, error } = await supabase
.from('messages')
.select('\*')
.eq('room_id', roomId)
.order('created_at', { ascending: true })
.range(messages.length, messages.length + 20); // Carrega mais 20 mensagens

    if (error) {
      console.log('Error ao buscar mensagens', error);
    } else {
      setMessages((prev) => [...data, ...prev]);
    }

};

useEffect(() => {
const fetchInitialMessages = async () => {
await loadMoreMessages();
setIsLoadingMessages(false);
};
fetchInitialMessages();
}, []);

// Calcula a altura de cada mensagem
const getItemSize = (index: number) => calculateHeight(index, messages);

const sendMessage = async () => {
if (newMessage.trim()) {
const { error } = await supabase.from('messages').insert({
room_id: roomId,
user_id: userId,
content: newMessage,
avatar_url: '', // Adicione o avatar se necessário
user_nickname: '', // Adicione o nickname se necessário
});

      if (!error) {
        setNewMessage('');
        await loadMoreMessages(); // Recarrega as mensagens
      } else {
        console.log('Error ao enviar mensagem', error);
      }
    }

};

if (isLoadingMessages) {
return <Spinner />;
}

return (

<div className='w-full p-4 h-full flex flex-col bg-gray-100'>
<div className='pb-4 bg-gray-100 flex justify-between items-center'>
<h1 className='text-xl font-bold'>Chat with strangers</h1>
</div>

      {/* Lista Virtualizada com Tamanho Variável */}
      <div className='flex-1 w-full h-full justify-center rounded-lg overflow-y-scroll scrollbar-thin p-4 bg-white' ref={parentRef}>
        <List
          height={500} // Altura do contêiner visível
          itemCount={messages.length}
          itemSize={getItemSize} // Calcula o tamanho do item dinamicamente
          width="100%"
          ref={listRef}
        >
          {({ index, style }) => {
            const message = messages[index];
            return (
              <div style={style} className='p-4 overflow-hidden w-full flex items-start justify-between bg-white'>
                <div className='flex w-full flex-col'>
                  <div className='pb-1 flex items-center w-full overflow-hidden gap-2'>
                    <div className='font-bold '>
                      {message.user_nickname ? (
                        <Image
                          src={`https://api.multiavatar.com/${message.user_nickname}.png`}
                          width={24}
                          height={24}
                          alt='Avatar'
                        />
                      ) : (
                        <FaUser />
                      )}
                    </div>
                    <span className='text-sm font-bold text-purple-600 break-words'>
                      {message.user_nickname}
                    </span>
                    <span className='text-xs ml-auto'>
                      {formatTime(message.created_at)}
                    </span>
                  </div>
                  <div className='w-full break-words'>{message.content}</div>
                </div>
              </div>
            );
          }}
        </List>
      </div>

      <div className='pt-2 bg-gray-100 border-gray-300'>
        <textarea
          ref={textareaRef}
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder='Digite sua mensagem'
          rows={3}
          className='w-full p-2 border rounded-md mb-2 outline-none resize-none'
        />
        <button
          onClick={sendMessage}
          className='w-full bg-purple-600 text-white p-2 rounded-md'
        >
          Enviar
        </button>
      </div>
    </div>

);
};

export default Messages;
