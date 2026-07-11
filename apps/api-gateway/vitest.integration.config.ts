import { defineConfig } from 'vitest/config';

// Integration suite: real Redis (docker/compose.dev.yml) + stubbed identity service.
// The full-stack path (real identity + real DB) is covered by Playwright in 1.9.
export default defineConfig({
  test: {
    include: ['test/**/*.integration.spec.ts'],
    testTimeout: 30_000,
    hookTimeout: 60_000,
    fileParallelism: false,
  },
});
