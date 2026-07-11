import type { LeaderboardPeriod } from '@lilochat/contracts';

/** ZSET keys per §6.5: alltime | YYYY-MM | YYYY-Www (ISO week). */
export function periodKeys(at: Date): string[] {
  return ['alltime', monthKey(at), weekKey(at)];
}

export function currentKeyFor(period: LeaderboardPeriod, at: Date): string {
  if (period === 'alltime') return 'alltime';
  return period === 'monthly' ? monthKey(at) : weekKey(at);
}

function monthKey(at: Date): string {
  return `${at.getUTCFullYear()}-${String(at.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** ISO-8601 week (the year can differ from the calendar year at boundaries). */
function weekKey(at: Date): string {
  const date = new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate()));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day); // nearest Thursday decides the ISO year
  const isoYear = date.getUTCFullYear();
  const yearStart = Date.UTC(isoYear, 0, 1);
  const week = Math.ceil(((date.getTime() - yearStart) / 86_400_000 + 1) / 7);
  return `${isoYear}-W${String(week).padStart(2, '0')}`;
}
