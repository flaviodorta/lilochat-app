import { Header } from '@/components/header';

/** Home v0: shell + skeleton grid. The real room directory arrives in Phase 2 (roadmap 2.9). */
export default function HomePage() {
  return (
    <>
      <Header />
      <main className="mx-auto max-w-7xl px-4 pb-16 sm:px-6">
        <section className="flex flex-col items-center gap-3 py-14 text-center">
          <h1 className="max-w-2xl text-balance text-4xl font-bold tracking-tight text-zinc-100 sm:text-5xl">
            Watch YouTube{' '}
            <span className="bg-gradient-to-r from-brand-soft to-accent bg-clip-text text-transparent">
              together
            </span>
            , in perfect sync
          </h1>
          <p className="max-w-xl text-pretty text-zinc-400">
            Public rooms with a shared queue and live chat. Nobody can pause — the room is the
            channel, and its people are the curators.
          </p>
        </section>

        <section aria-label="Rooms" className="relative">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }, (_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="rounded-full border border-edge bg-surface/90 px-5 py-2.5 text-sm text-zinc-300 shadow-xl shadow-black/40 backdrop-blur">
              🎬 Rooms open in <span className="font-semibold text-brand-soft">Phase 2</span> —
              under construction
            </span>
          </div>
        </section>
      </main>
    </>
  );
}

function SkeletonCard() {
  return (
    <div className="overflow-hidden rounded-xl border border-edge bg-surface">
      <div className="aspect-video animate-pulse bg-surface-raised/60" />
      <div className="flex flex-col gap-2 p-4">
        <div className="h-4 w-2/3 animate-pulse rounded bg-surface-raised/60" />
        <div className="h-3 w-1/3 animate-pulse rounded bg-surface-raised/40" />
      </div>
    </div>
  );
}
