import { defineConfig } from 'vitest/config';

// Integration suite: real RabbitMQ + Redis from docker/compose.dev.yml
// (same repo pattern as identity/gateway — one infra, every suite).
export default defineConfig({
  test: {
    include: ['test/**/*.integration.spec.ts'],
    testTimeout: 30_000,
    hookTimeout: 60_000,
    fileParallelism: false,
  },
});
