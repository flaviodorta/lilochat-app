'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Socket } from 'socket.io-client';

export interface OpenVote {
  voteId: string;
  itemId: string;
  endsAt: string;
  yes: number;
  needed: number;
}

export interface VoteResult {
  passed: boolean;
  yes: number;
  needed: number;
  at: number;
}

interface VoteAck {
  ok: boolean;
  error?: string;
  voteId?: string;
  itemId?: string;
  endsAt?: string;
  yes?: number;
  needed?: number;
}

/** Client half of §6.4: overlay state driven by vote:* broadcasts. */
export function useRoomVotes(roomId: string, socket: Socket | null) {
  const [open, setOpen] = useState<OpenVote | null>(null);
  const [hasVoted, setHasVoted] = useState(false);
  const [result, setResult] = useState<VoteResult | null>(null);
  const [cooldownUntil, setCooldownUntil] = useState(0);

  useEffect(() => {
    if (!socket) return;

    const onStarted = (payload: OpenVote & { roomId: string }) => {
      if (payload.roomId !== roomId) return;
      setOpen(payload);
      setHasVoted(false);
      setResult(null);
    };
    const onProgress = (payload: { roomId: string; yes: number; needed: number }) => {
      if (payload.roomId !== roomId) return;
      setOpen((current) =>
        current ? { ...current, yes: payload.yes, needed: payload.needed } : current,
      );
    };
    const onFinished = (payload: {
      roomId: string;
      passed: boolean;
      yes: number;
      needed: number;
    }) => {
      if (payload.roomId !== roomId) return;
      setOpen(null);
      setResult({
        passed: payload.passed,
        yes: payload.yes,
        needed: payload.needed,
        at: Date.now(),
      });
      if (!payload.passed) setCooldownUntil(Date.now() + 90_000); // §3.4 cooldown
    };

    socket.on('vote:started', onStarted);
    socket.on('vote:progress', onProgress);
    socket.on('vote:finished', onFinished);
    return () => {
      socket.off('vote:started', onStarted);
      socket.off('vote:progress', onProgress);
      socket.off('vote:finished', onFinished);
    };
  }, [socket, roomId]);

  const startVote = useCallback((): Promise<string | null> => {
    if (!socket) return Promise.resolve('not_connected');
    return new Promise((resolve) => {
      socket.emit('vote:start', undefined, (ack: VoteAck) => {
        if (ack.ok) {
          setHasVoted(true); // starting IS voting yes
          if (ack.error === undefined && ack.voteId && ack.endsAt) {
            // seed immediately — the broadcast will confirm/refresh
            setOpen({
              voteId: ack.voteId,
              itemId: ack.itemId ?? '',
              endsAt: ack.endsAt,
              yes: ack.yes ?? 1,
              needed: ack.needed ?? 1,
            });
          }
          resolve(null);
        } else {
          if (ack.error === 'VOTE_COOLDOWN') setCooldownUntil(Date.now() + 90_000);
          resolve(ack.error ?? 'unknown');
        }
      });
    });
  }, [socket]);

  const castVote = useCallback(
    (voteId: string) => {
      if (!socket) return;
      setHasVoted(true);
      socket.emit('vote:cast', { voteId }, () => undefined);
    },
    [socket],
  );

  return {
    open,
    hasVoted,
    result,
    cooldownUntil,
    startVote,
    castVote,
    dismissResult: () => setResult(null),
  };
}
