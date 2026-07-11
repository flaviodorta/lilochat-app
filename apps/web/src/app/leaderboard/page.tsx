import { Header } from '@/components/header';
import { LeaderboardView } from './leaderboard-view';

export const metadata = { title: 'Leaderboard' };

export default function LeaderboardPage() {
  return (
    <>
      <Header />
      <main className="mx-auto max-w-3xl px-4 pb-16 sm:px-6">
        <LeaderboardView />
      </main>
    </>
  );
}
