import type { Metadata } from 'next';
import { Inter, Luckiest_Guy } from 'next/font/google';
import type { ReactNode } from 'react';
import { SITE_URL } from '@/lib/site';
import { Providers } from './providers';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
// Luckiest Guy: loaded once, used ONLY by the wordmark component
const luckiestGuy = Luckiest_Guy({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-luckiest',
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: 'LiloChat — Watch YouTube together', template: '%s · LiloChat' },
  description:
    'Public rooms where everyone watches YouTube in perfect sync. Chat, build the queue, vote to skip — nobody can pause.',
  icons: [
    { rel: 'icon', url: '/lilochat-logo.svg', type: 'image/svg+xml' },
    { rel: 'icon', url: '/icon-32.png', sizes: '32x32', type: 'image/png' },
    { rel: 'apple-touch-icon', url: '/apple-touch-icon.png', sizes: '180x180' },
  ],
  manifest: '/manifest.webmanifest',
  openGraph: {
    siteName: 'LiloChat',
    type: 'website',
    locale: 'en_US',
  },
  twitter: { card: 'summary_large_image' },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${luckiestGuy.variable}`}>
      <body className="min-h-dvh font-sans">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
