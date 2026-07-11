'use client';

import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/cn';
import type { OpenVote, VoteResult } from './use-room-votes';

const WINDOW_S = 45;

/** §12.2: bottom-center floating card, spring-in, countdown ring, live progress. */
export function VoteOverlay({
  vote,
  hasVoted,
  result,
  onCast,
  onDismissResult,
}: {
  vote: OpenVote | null;
  hasVoted: boolean;
  result: VoteResult | null;
  onCast: (voteId: string) => void;
  onDismissResult: () => void;
}) {
  // auto-hide the result banner
  useEffect(() => {
    if (!result) return;
    const timer = setTimeout(onDismissResult, 4_000);
    return () => clearTimeout(timer);
  }, [result, onDismissResult]);

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-8 z-40 flex justify-center">
      <AnimatePresence>
        {vote && (
          <motion.div
            key={vote.voteId}
            initial={{ y: 48, opacity: 0, scale: 0.95 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 24, opacity: 0, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 380, damping: 28 }}
            data-testid="vote-overlay"
            className="pointer-events-auto flex items-center gap-4 rounded-2xl border border-brand/40 bg-surface/95 px-5 py-4 shadow-2xl shadow-black/50 backdrop-blur glow-brand"
          >
            <CountdownRing endsAt={vote.endsAt} />
            <div>
              <p className="font-semibold text-zinc-100">Skip this video?</p>
              <p className="text-sm text-zinc-400">
                <span data-testid="vote-yes-count" className="font-mono tabular-nums text-warning">
                  {vote.yes}/{vote.needed}
                </span>{' '}
                votes to skip
              </p>
            </div>
            <button
              type="button"
              data-testid="vote-cast-btn"
              disabled={hasVoted}
              onClick={() => onCast(vote.voteId)}
              className={cn(
                'focus-ring rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition-all',
                hasVoted
                  ? 'cursor-default bg-surface-raised text-zinc-400'
                  : 'bg-gradient-to-r from-brand to-accent hover:brightness-110',
              )}
            >
              {hasVoted ? 'Voted ✓' : 'Vote skip'}
            </button>
          </motion.div>
        )}

        {result && !vote && (
          <motion.div
            key="result"
            initial={{ y: 24, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 24, opacity: 0 }}
            data-testid="vote-result"
            className={cn(
              'pointer-events-auto rounded-full px-5 py-2.5 text-sm font-medium text-white shadow-xl backdrop-blur',
              result.passed ? 'bg-positive/90 text-zinc-900' : 'bg-surface-raised/95',
            )}
          >
            {result.passed
              ? `⏭ Vote passed (${result.yes}/${result.needed}) — skipping!`
              : `Vote failed (${result.yes}/${result.needed}) — the video stays`}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function CountdownRing({ endsAt }: { endsAt: string }) {
  const [remaining, setRemaining] = useState(WINDOW_S);
  useEffect(() => {
    const tick = () => setRemaining(Math.max(0, (new Date(endsAt).getTime() - Date.now()) / 1000));
    tick();
    const timer = setInterval(tick, 250);
    return () => clearInterval(timer);
  }, [endsAt]);

  const radius = 18;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.min(1, remaining / WINDOW_S);

  return (
    <div className="relative size-12 shrink-0">
      <svg viewBox="0 0 44 44" className="size-full -rotate-90">
        <circle
          cx="22"
          cy="22"
          r={radius}
          className="fill-none stroke-surface-raised"
          strokeWidth="4"
        />
        <circle
          cx="22"
          cy="22"
          r={radius}
          strokeWidth="4"
          strokeLinecap="round"
          className={cn(
            'fill-none transition-[stroke-dashoffset] duration-300 ease-linear',
            remaining <= 10 ? 'stroke-live' : 'stroke-warning',
          )}
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - progress)}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center font-mono text-xs tabular-nums text-zinc-200">
        {Math.ceil(remaining)}
      </span>
    </div>
  );
}
