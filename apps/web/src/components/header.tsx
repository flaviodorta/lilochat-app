'use client';

import Link from 'next/link';
import { Suspense, useState } from 'react';
import { Wordmark } from '@/components/brand/wordmark';
import { SearchInput } from '@/components/search-input';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/features/auth/auth-context';
import { Avatar } from '@/features/auth/avatar';
import { CreateRoomModal } from '@/features/rooms/create-room-modal';

export function Header() {
  const { status, user, openAuthModal, signOut } = useAuth();
  const [creatingRoom, setCreatingRoom] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-edge-soft bg-surface-page/70 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6">
        <Link href="/" className="focus-ring rounded-lg" aria-label="LiloChat home">
          <Wordmark />
        </Link>

        <div className="mx-auto w-full max-w-md max-md:hidden">
          {/* Suspense: useSearchParams inside would otherwise bail the whole page to CSR */}
          <Suspense fallback={<div className="h-9 rounded-full border border-edge bg-surface" />}>
            <SearchInput />
          </Suspense>
        </div>

        <Link
          href="/leaderboard"
          className="focus-ring rounded-lg px-2 py-1 text-sm font-medium text-zinc-400 transition-colors hover:text-zinc-100 max-sm:hidden"
        >
          🏆 Leaderboard
        </Link>

        <div className="ml-auto flex items-center gap-3">
          <Button
            size="sm"
            onClick={() =>
              status === 'authenticated' ? setCreatingRoom(true) : openAuthModal('signup')
            }
          >
            + Create room
          </Button>
          <CreateRoomModal open={creatingRoom} onClose={() => setCreatingRoom(false)} />

          {status === 'authenticated' && user ? (
            <UserChip nickname={user.nickname} onSignOut={() => void signOut()} />
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => openAuthModal('signin')}
              disabled={status === 'loading'}
            >
              Sign in
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}

function UserChip({ nickname, onSignOut }: { nickname: string; onSignOut: () => void }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        className="focus-ring flex items-center gap-2 rounded-full border border-edge bg-surface py-1 pl-1 pr-3 transition-colors hover:border-zinc-600"
      >
        <Avatar seed={nickname} size="sm" />
        <span className="max-w-28 truncate text-sm font-medium text-zinc-200">{nickname}</span>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-40 overflow-hidden rounded-xl border border-edge bg-surface shadow-xl shadow-black/40">
          <button
            type="button"
            onClick={onSignOut}
            className="w-full px-4 py-2.5 text-left text-sm text-zinc-300 transition-colors hover:bg-surface-raised hover:text-zinc-100"
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
