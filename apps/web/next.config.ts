import type { NextConfig } from 'next';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4100';
const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? 'http://localhost:4110';
const wsOrigin = WS_URL.replace(/^http/, 'ws'); // socket.io upgrades to ws(s)://
const dev = process.env.NODE_ENV !== 'production';

/**
 * CSP (§9.2). Everything the page legitimately talks to, nothing else:
 * - YouTube: iframe player + its api scripts + thumbnails (§5.1 — video bytes
 *   never touch our infra, so YouTube is the one third-party origin)
 * - our gateway (REST + avatar <img>) and realtime-gateway (WS)
 * - 'unsafe-inline' script: Next.js App Router hydration payload (v1 call —
 *   nonce-based strict CSP needs per-request middleware; tracked as evolution)
 * - 'unsafe-eval' only in dev (react-refresh needs it; never in prod)
 */
const csp = [
  `default-src 'self'`,
  `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ''} https://www.youtube.com https://s.ytimg.com`,
  `frame-src https://www.youtube.com https://www.youtube-nocookie.com`,
  `img-src 'self' data: https://i.ytimg.com ${API_URL}`,
  `connect-src 'self' ${API_URL} ${WS_URL} ${wsOrigin}`,
  `style-src 'self' 'unsafe-inline'`, // Tailwind runtime + next/font inline blocks
  `font-src 'self' data:`,
  `object-src 'none'`,
  `base-uri 'self'`,
  `form-action 'self'`,
  `frame-ancestors 'none'`, // nobody embeds LiloChat
].join('; ');

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: 'standalone', // self-contained server bundle for the Docker image
  // NOTE: no `ignoreBuildErrors` / `ignoreDuringBuilds` here — ever (legacy lesson).
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'Content-Security-Policy', value: csp },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
};

export default nextConfig;
