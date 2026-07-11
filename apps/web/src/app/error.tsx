'use client';

import Link from 'next/link';
import { Header } from '@/components/header';

/** Route-segment error boundary — the shell survives, the content apologizes. */
export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <>
      <Header />
      <main className="mx-auto flex max-w-7xl flex-col items-center gap-4 px-4 py-28 text-center">
        <p className="text-7xl font-bold tracking-tight">
          <span className="bg-gradient-to-r from-brand-soft to-accent bg-clip-text text-transparent">
            500
          </span>
        </p>
        <h1 className="text-xl font-semibold text-zinc-200">We dropped the remote</h1>
        <p className="max-w-md text-pretty text-sm text-zinc-400">
          Something broke on our side. The rooms keep playing — try again, or head back to the
          lounge.
        </p>
        <div className="mt-2 flex gap-3">
          <button
            type="button"
            onClick={reset}
            className="focus-ring rounded-full bg-gradient-to-r from-brand to-accent px-5 py-2.5 text-sm font-semibold text-white transition-transform duration-150 hover:scale-105 motion-reduce:hover:scale-100"
          >
            Try again
          </button>
          <Link
            href="/"
            className="focus-ring rounded-full border border-edge bg-surface px-5 py-2.5 text-sm font-medium text-zinc-300 transition-colors hover:border-zinc-600"
          >
            Back to the lounge
          </Link>
        </div>
      </main>
    </>
  );
}
