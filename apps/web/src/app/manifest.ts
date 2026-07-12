import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'LiloChat — Watch YouTube together',
    short_name: 'LiloChat',
    description: 'Public rooms where everyone watches YouTube in perfect sync. Nobody can pause.',
    start_url: '/',
    display: 'standalone',
    background_color: '#09090b', // zinc-950 (§12.1)
    theme_color: '#9333ea', // brand purple
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
  };
}
