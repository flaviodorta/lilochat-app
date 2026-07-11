'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import type {
  LeaderboardPeriod,
  LeaderboardResponse,
  LeaderboardRow,
  UserStats,
} from '@lilochat/contracts';
import { useAuth } from '@/features/auth/auth-context';
import { Avatar } from '@/features/auth/avatar';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';

const PERIODS: Array<{ id: LeaderboardPeriod; label: string }> = [
  { id: 'alltime', label: 'All-time' },
  { id: 'monthly', label: 'Monthly' },
  { id: 'weekly', label: 'Weekly' },
];

function formatWatchTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${String(minutes).padStart(2, '0')}m`;
  return `${minutes}m ${String(Math.floor(seconds % 60)).padStart(2, '0')}s`;
}

/** §12.2: period tabs, top-3 podium with medal glows, ranked rows, own row pinned. */
export function LeaderboardView() {
  const [period, setPeriod] = useState<LeaderboardPeriod>('alltime');
  const { status, user, accessToken } = useAuth();

  const board = useQuery({
    queryKey: ['leaderboard', period],
    queryFn: () => api<LeaderboardResponse>(`/leaderboard?period=${period}&limit=50`),
    refetchInterval: 60_000, // leaderboard staleness budget (§8)
  });
  const myStats = useQuery({
    queryKey: ['my-stats'],
    queryFn: () => api<UserStats>('/users/me/stats', { accessToken: accessToken ?? undefined }),
    enabled: status === 'authenticated',
    refetchInterval: 60_000,
  });

  const rows = board.data?.rows ?? [];
  const podium = rows.slice(0, 3);
  const rest = rows.slice(3);
  const mine = myStats.data?.periods[period];

  return (
    <div className="flex flex-col gap-8 py-10">
      <header className="flex flex-col items-center gap-4">
        <h1 className="text-3xl font-bold tracking-tight">
          Watch-time{' '}
          <span className="bg-gradient-to-r from-brand-soft to-accent bg-clip-text text-transparent">
            leaderboard
          </span>
        </h1>
        <div className="flex gap-1 rounded-full border border-edge bg-surface p-1">
          {PERIODS.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setPeriod(option.id)}
              className={cn(
                'focus-ring rounded-full px-4 py-1.5 text-sm font-medium transition-colors',
                period === option.id
                  ? 'bg-gradient-to-r from-brand to-accent text-white'
                  : 'text-zinc-400 hover:text-zinc-200',
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      </header>

      {board.isLoading ? (
        <p className="py-16 text-center text-sm text-zinc-500">Summoning the champions…</p>
      ) : rows.length === 0 ? (
        <p className="py-16 text-center text-sm text-zinc-500">
          Nobody on the board yet — go watch something! 🎬
        </p>
      ) : (
        <>
          {/* podium: 2nd · 1st · 3rd */}
          <div className="flex items-end justify-center gap-6" data-testid="podium">
            {[podium[1], podium[0], podium[2]].map(
              (row, position) =>
                row && (
                  <PodiumSpot
                    key={row.userId}
                    row={row}
                    highlight={position === 1}
                    self={row.userId === user?.id}
                  />
                ),
            )}
          </div>

          <ol className="flex flex-col gap-1.5">
            {rest.map((row) => (
              <RankRow key={row.userId} row={row} self={row.userId === user?.id} />
            ))}
          </ol>
        </>
      )}

      {/* own row pinned (§12.2) */}
      {status === 'authenticated' && user && mine && (
        <div className="sticky bottom-4">
          <div className="glow-brand flex items-center gap-3 rounded-xl border border-brand/40 bg-surface/95 px-4 py-3 backdrop-blur">
            <span className="w-10 text-center font-mono text-sm text-brand-soft">
              {mine.rank ? `#${mine.rank}` : '—'}
            </span>
            <Avatar seed={user.nickname} size="sm" />
            <span className="flex-1 truncate text-sm font-semibold">{user.nickname} (you)</span>
            <span className="font-mono text-sm tabular-nums text-zinc-300">
              {formatWatchTime(mine.seconds)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

const MEDALS = [
  'ring-warning shadow-warning/30',
  'ring-zinc-400 shadow-zinc-400/20',
  'ring-amber-700 shadow-amber-700/20',
];

function PodiumSpot({
  row,
  highlight,
  self,
}: {
  row: LeaderboardRow;
  highlight: boolean;
  self: boolean;
}) {
  const medal = MEDALS[row.rank - 1] ?? MEDALS[2];
  return (
    <div className={cn('flex flex-col items-center gap-2', highlight ? 'pb-6' : 'pb-0')}>
      <span className="text-2xl">{['🥇', '🥈', '🥉'][row.rank - 1]}</span>
      <Avatar
        seed={row.nickname}
        size="lg"
        className={cn('shadow-lg ring-4', medal, highlight ? 'size-28' : 'size-20')}
      />
      <p className={cn('max-w-28 truncate font-semibold', self && 'text-brand-soft')}>
        {row.nickname}
      </p>
      <p className="font-mono text-xs tabular-nums text-zinc-400">{formatWatchTime(row.seconds)}</p>
    </div>
  );
}

function RankRow({ row, self }: { row: LeaderboardRow; self: boolean }) {
  return (
    <li
      className={cn(
        'flex items-center gap-3 rounded-xl border px-4 py-2.5 transition-colors',
        self ? 'border-brand/40 bg-brand/10' : 'border-edge bg-surface hover:bg-surface-raised/40',
      )}
    >
      <span className="w-10 text-center font-mono text-sm text-zinc-500">#{row.rank}</span>
      <Avatar seed={row.nickname} size="sm" />
      <span className={cn('flex-1 truncate text-sm font-medium', self && 'text-brand-soft')}>
        {row.nickname}
        {self && ' (you)'}
      </span>
      <span className="font-mono text-sm tabular-nums text-zinc-300">
        {formatWatchTime(row.seconds)}
      </span>
    </li>
  );
}
