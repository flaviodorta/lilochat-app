'use client';

import { useInfiniteQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Socket } from 'socket.io-client';
import type {
  ChatAckPayload,
  ChatNewPayload,
  ListMessagesResponse,
  PresenceStatePayload,
  PresenceUser,
} from '@lilochat/contracts';
import { api } from '@/lib/api';

export interface UiMessage {
  key: string; // messageId when durable, tempId while pending
  kind: 'user' | 'system';
  userId: string;
  nickname: string;
  content: string;
  at: string;
  status: 'pending' | 'sent' | 'failed';
}

const ACK_TIMEOUT_MS = 8_000;

/**
 * Chat client state (§6.3): history via REST (newest page first, scroll up for
 * older), live messages via optimistic chat:new reconciled by chat:ack — a
 * pending message without an ack within 8s is marked failed (client-side
 * retraction; simpler than a DLQ watcher, same UX).
 */
export function useRoomChat(roomId: string, socket: Socket | null) {
  const [live, setLive] = useState<UiMessage[]>([]);
  const [present, setPresent] = useState<PresenceUser[]>([]);
  const ackTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const systemRef = useRef<(content: string) => void>(() => undefined);

  const history = useInfiniteQuery({
    queryKey: ['messages', roomId],
    queryFn: ({ pageParam }) =>
      api<ListMessagesResponse>(
        `/rooms/${roomId}/messages${pageParam ? `?cursor=${pageParam}` : ''}`,
      ),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    refetchOnWindowFocus: false,
    staleTime: Infinity, // live socket keeps it fresh; pages are immutable history
  });

  useEffect(() => {
    if (!socket) return;

    const onNew = (message: ChatNewPayload) => {
      if (message.roomId !== roomId) return;
      setLive((current) => [
        ...current,
        {
          key: message.tempId,
          kind: 'user',
          userId: message.userId,
          nickname: message.nickname,
          content: message.content,
          at: message.sentAt,
          status: 'pending',
        },
      ]);
      const timer = setTimeout(() => {
        setLive((current) =>
          current.map((m) => (m.key === message.tempId ? { ...m, status: 'failed' } : m)),
        );
        ackTimers.current.delete(message.tempId);
      }, ACK_TIMEOUT_MS);
      ackTimers.current.set(message.tempId, timer);
    };

    const onAck = (ack: ChatAckPayload) => {
      const timer = ackTimers.current.get(ack.tempId);
      if (timer) clearTimeout(timer);
      ackTimers.current.delete(ack.tempId);
      setLive((current) =>
        current.map((m) =>
          m.key === ack.tempId
            ? { ...m, key: ack.messageId, at: ack.createdAt, status: 'sent' }
            : m,
        ),
      );
    };

    const onPresenceState = (state: PresenceStatePayload) => {
      if (state.roomId === roomId) setPresent(state.users);
    };
    const onJoined = (user: PresenceUser) =>
      setPresent((current) =>
        current.some((u) => u.userId === user.userId) ? current : [...current, user],
      );
    const onLeft = ({ userId }: { userId: string }) =>
      setPresent((current) => current.filter((u) => u.userId !== userId));

    // in-stream system chips (§3.5): client-side, not persisted (v1 decision)
    let systemSeq = 0;
    const system = (content: string) =>
      setLive((current) => [
        ...current,
        {
          key: `sys-${Date.now()}-${systemSeq++}`,
          kind: 'system' as const,
          userId: '',
          nickname: '',
          content,
          at: new Date().toISOString(),
          status: 'sent' as const,
        },
      ]);
    systemRef.current = system; // send() (outside this effect) can chip too
    const onPlaybackStarted = (payload: { roomId: string; title: string }) => {
      if (payload.roomId === roomId) system(`▶ Now playing: ${payload.title}`);
    };
    const onVoteStarted = (payload: { roomId: string }) => {
      if (payload.roomId === roomId) system('🗳 A skip vote has started');
    };
    const onVoteFinished = (payload: { roomId: string; passed: boolean }) => {
      if (payload.roomId === roomId)
        system(payload.passed ? '⏭ Vote passed — skipping' : '🗳 Vote failed — the video stays');
    };
    socket.on('playback:started', onPlaybackStarted);
    socket.on('vote:started', onVoteStarted);
    socket.on('vote:finished', onVoteFinished);

    socket.on('chat:new', onNew);
    socket.on('chat:ack', onAck);
    socket.on('presence:state', onPresenceState);
    socket.on('presence:joined', onJoined);
    socket.on('presence:left', onLeft);
    return () => {
      socket.off('chat:new', onNew);
      socket.off('chat:ack', onAck);
      socket.off('presence:state', onPresenceState);
      socket.off('presence:joined', onJoined);
      socket.off('presence:left', onLeft);
      socket.off('playback:started', onPlaybackStarted);
      socket.off('vote:started', onVoteStarted);
      socket.off('vote:finished', onVoteFinished);
      for (const timer of ackTimers.current.values()) clearTimeout(timer);
      ackTimers.current.clear();
    };
  }, [socket, roomId]);

  const send = useCallback(
    (content: string) => {
      if (!socket) return;
      const tempId = `tmp-${Math.random().toString(36).slice(2, 10)}`;
      socket.emit('chat:send', { tempId, content }, (result: { ok: boolean; error?: string }) => {
        if (!result.ok) {
          setLive((current) =>
            current.map((m) => (m.key === tempId ? { ...m, status: 'failed' } : m)),
          );
          if (result.error === 'chat_disabled') {
            systemRef.current('💤 Chat is temporarily disabled by the crew');
          }
        }
      });
      // the optimistic chat:new echo (we're in the room) renders it — no local add
    },
    [socket],
  );

  /** history pages (newest→oldest) reversed + live tail, deduped by key. */
  const messages = useMemo<UiMessage[]>(() => {
    const historical =
      history.data?.pages
        .flatMap((page) => page.items)
        .reverse()
        .map<UiMessage>((m) => ({
          key: m.id,
          kind: 'user',
          userId: m.userId,
          nickname: m.nickname,
          content: m.content,
          at: m.createdAt,
          status: 'sent',
        })) ?? [];
    const seen = new Set(historical.map((m) => m.key));
    return [...historical, ...live.filter((m) => !seen.has(m.key))];
  }, [history.data, live]);

  return { messages, present, send, history };
}
