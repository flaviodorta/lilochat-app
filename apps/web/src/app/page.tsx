import { Header } from '@/components/header';
import { OnboardingHint } from '@/components/onboarding-hint';
import { RoomsGrid } from '@/features/rooms/rooms-grid';

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

        <OnboardingHint />

        <section aria-label="Rooms">
          <RoomsGrid />
        </section>
      </main>
    </>
  );
}
