import Link from 'next/link';
import { Header } from '@/components/header';

export default function NotFound() {
  return (
    <>
      <Header />
      <main className="mx-auto flex max-w-7xl flex-col items-center gap-4 px-4 py-28 text-center">
        <p className="text-7xl font-bold tracking-tight">
          <span className="bg-gradient-to-r from-brand-soft to-accent bg-clip-text text-transparent">
            404
          </span>
        </p>
        <h1 className="text-xl font-semibold text-zinc-200">This channel is pure static</h1>
        <p className="max-w-md text-pretty text-sm text-zinc-400">
          The page you tuned into doesn&apos;t exist — maybe the room was archived, maybe the link
          drifted out of sync.
        </p>
        <Link
          href="/"
          className="focus-ring mt-2 rounded-full bg-gradient-to-r from-brand to-accent px-5 py-2.5 text-sm font-semibold text-white transition-transform duration-150 hover:scale-105 motion-reduce:hover:scale-100"
        >
          Back to the lounge
        </Link>
      </main>
    </>
  );
}
