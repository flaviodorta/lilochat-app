import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // NOTE: no `ignoreBuildErrors` / `ignoreDuringBuilds` here — ever (legacy lesson).
};

export default nextConfig;
