import { defineConfig } from 'vitest/config';

// Integration suite: real Postgres (docker/compose.dev.yml) + real argon2/JWT.
// Run with `pnpm test:int`; kept out of `turbo test` until CI provisions a database.
export default defineConfig({
  test: {
    include: ['test/**/*.integration.spec.ts'],
    testTimeout: 30_000,
    hookTimeout: 60_000,
    fileParallelism: false, // suites share one database
  },
});
