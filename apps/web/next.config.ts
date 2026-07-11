import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: 'standalone', // self-contained server bundle for the Docker image
  // NOTE: no `ignoreBuildErrors` / `ignoreDuringBuilds` here — ever (legacy lesson).
};

export default nextConfig;
