'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { Socket } from 'socket.io-client';
import type { PresenceUser } from '@lilochat/contracts';
import { Avatar } from '@/features/auth/avatar';
import { cn } from '@/lib/cn';
import { useRoomChat, type UiMessage } from './use-room-chat';

/** Deterministic nickname color (§3.5): hash → hue, fixed s/l for dark bg. */
function nicknameColor(nickname: string): string {
  let hash = 0;
  for (const char of nickname) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return `hsl(${((hash % 360) + 360) % 360} 70% 70%)`;
}

const timeOf = (iso: string) =>
  new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

export function ChatPanel({
  roomId,
  socket,
  canChat,
  onNeedAuth,
}: {
  roomId: string;
  socket: Socket | null;
  canChat: boolean;
  onNeedAuth: () => void;
}) {
  const { messages, present, send, history } = useRoomChat(roomId, socket);
  const [draft, setDraft] = useState('');
  const listRef = useRef<HTMLDivElement>(null);
  const pinnedToBottom = useRef(true);

  // stick to the bottom unless the user scrolled up to read history
  useEffect(() => {
    const list = listRef.current;
    if (list && pinnedToBottom.current) list.scrollTop = list.scrollHeight;
  }, [messages.length]);

  const onScroll = () => {
    const list = listRef.current;
    if (!list) return;
    pinnedToBottom.current = list.scrollHeight - list.scrollTop - list.clientHeight < 40;
    if (list.scrollTop < 60 && history.hasNextPage && !history.isFetchingNextPage) {
      const before = list.scrollHeight;
      void history.fetchNextPage().then(() => {
        // keep the viewport anchored on the same message after prepending
        requestAnimationFrame(() => {
          list.scrollTop = list.scrollHeight - before + list.scrollTop;
        });
      });
    }
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const content = draft.trim();
    if (!content) return;
    if (!canChat) return onNeedAuth();
    send(content);
    setDraft('');
  };

  return (
    <aside className="flex h-[min(720px,calc(100dvh-8rem))] flex-col rounded-xl border border-edge bg-surface lg:h-auto lg:min-h-[560px]">
      <header className="flex items-center justify-between border-b border-edge px-4 py-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">Chat</h2>
        <PresenceStack users={present} />
      </header>

      <div
        ref={listRef}
        onScroll={onScroll}
        data-testid="chat-messages"
        className="flex-1 space-y-3 overflow-y-auto px-4 py-3"
      >
        {history.isFetchingNextPage && (
          <p className="text-center text-xs text-zinc-600">Loading older messages…</p>
        )}
        {messages.length === 0 && (
          <p className="py-10 text-center text-sm text-zinc-500">Quiet in here… say hi! 👋</p>
        )}
        {messages.map((message) => (
          <MessageRow key={message.key} message={message} />
        ))}
      </div>

      <form onSubmit={submit} className="border-t border-edge p-3">
        <div className="flex items-end gap-2">
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                event.currentTarget.form?.requestSubmit();
              }
            }}
            rows={1}
            maxLength={500}
            placeholder={canChat ? 'Send a message…' : 'Sign in to chat'}
            data-testid="chat-input"
            className={cn(
              'focus-ring max-h-28 min-h-10 flex-1 resize-none rounded-lg border border-edge bg-surface-raised/40',
              'px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500',
            )}
          />
          <button
            type="submit"
            aria-label="Send"
            className="focus-ring flex size-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-r from-brand to-accent text-white transition-all hover:brightness-110 disabled:opacity-40"
            disabled={canChat && draft.trim().length === 0}
          >
            ➤
          </button>
        </div>
        {draft.length >= 400 && (
          <p
            className={cn(
              'mt-1 text-right text-xs',
              draft.length >= 500 ? 'text-live' : 'text-zinc-500',
            )}
          >
            {draft.length}/500
          </p>
        )}
      </form>
    </aside>
  );
}

function MessageRow({ message }: { message: UiMessage }) {
  if (message.kind === 'system') {
    return (
      <p className="py-0.5 text-center text-xs text-zinc-500" data-kind="system">
        {message.content}
      </p>
    );
  }
  return (
    <div
      className={cn(
        'group flex items-start gap-2.5 transition-opacity',
        message.status === 'pending' && 'opacity-60',
        message.status === 'failed' && 'opacity-40',
      )}
      data-status={message.status}
    >
      <Avatar seed={message.nickname} size="sm" className="mt-0.5" />
      <div className="min-w-0 flex-1">
        <p className="flex items-baseline gap-2">
          <span
            className="text-sm font-semibold"
            style={{ color: nicknameColor(message.nickname) }}
          >
            {message.nickname}
          </span>
          <span className="text-[10px] text-zinc-600 opacity-0 transition-opacity group-hover:opacity-100">
            {timeOf(message.at)}
          </span>
        </p>
        <p className="break-words text-[15px] leading-snug text-zinc-200">
          {message.content}
          {message.status === 'failed' && (
            <span className="ml-2 text-xs text-live">not delivered</span>
          )}
        </p>
      </div>
    </div>
  );
}

function PresenceStack({ users }: { users: PresenceUser[] }) {
  const shown = users.slice(0, 5);
  return (
    <div className="flex items-center" data-testid="presence-stack" data-count={users.length}>
      <div className="flex -space-x-2">
        {shown.map((user) => (
          <span key={user.userId} title={user.nickname}>
            <Avatar seed={user.nickname} size="sm" className="ring-2 ring-surface" />
          </span>
        ))}
      </div>
      {users.length > shown.length && (
        <span className="ml-1.5 text-xs text-zinc-500">+{users.length - shown.length}</span>
      )}
      <span className="ml-2 text-xs font-medium text-positive">{users.length} here</span>
    </div>
  );
}
