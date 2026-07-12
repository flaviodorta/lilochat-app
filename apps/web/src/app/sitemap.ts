import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/site';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4100';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticEntries: MetadataRoute.Sitemap = [
    { url: SITE_URL, changeFrequency: 'always', priority: 1 },
    { url: `${SITE_URL}/leaderboard`, changeFrequency: 'hourly', priority: 0.6 },
  ];

  // live rooms are the interesting URLs; directory down → static entries only
  try {
    const response = await fetch(`${API_URL}/rooms`, { next: { revalidate: 600 } });
    if (!response.ok) return staticEntries;
    const page = (await response.json()) as { items?: Array<{ id: string }> };
    const rooms: MetadataRoute.Sitemap = (page.items ?? []).map((room) => ({
      url: `${SITE_URL}/room/${room.id}`,
      changeFrequency: 'always',
      priority: 0.8,
    }));
    return [...staticEntries, ...rooms];
  } catch {
    return staticEntries;
  }
}
