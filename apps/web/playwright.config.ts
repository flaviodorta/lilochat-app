import { defineConfig, devices } from '@playwright/test';

/**
 * Full-stack E2E: Playwright boots identity + gateway + web on dedicated test
 * ports (dev infra from docker/compose.dev.yml must be up). Roadmap 1.9.
 */
const IDENTITY_PORT = 4111;
const GATEWAY_PORT = 4110;
const WEB_PORT = 3010;

export default defineConfig({
  testDir: './e2e',
  timeout: 45_000,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    trace: 'retain-on-failure',
    ...devices['Desktop Chrome'],
  },
  webServer: [
    {
      command: './node_modules/.bin/tsx src/main.ts',
      cwd: '../services/identity',
      url: `http://localhost:${IDENTITY_PORT}/health/ready`,
      timeout: 30_000,
      reuseExistingServer: !process.env.CI,
      env: { PORT: String(IDENTITY_PORT) }, // dotenv fills the rest, never overriding these
    },
    {
      command: './node_modules/.bin/tsx src/main.ts',
      cwd: '../api-gateway',
      url: `http://localhost:${GATEWAY_PORT}/health/ready`,
      timeout: 30_000,
      reuseExistingServer: !process.env.CI,
      env: {
        PORT: String(GATEWAY_PORT),
        IDENTITY_SERVICE_URL: `http://localhost:${IDENTITY_PORT}`,
        CORS_ORIGINS: `http://localhost:${WEB_PORT}`,
      },
    },
    {
      command: `./node_modules/.bin/next dev -p ${WEB_PORT}`,
      url: `http://localhost:${WEB_PORT}`,
      timeout: 60_000,
      reuseExistingServer: !process.env.CI,
      env: { NEXT_PUBLIC_API_URL: `http://localhost:${GATEWAY_PORT}` },
    },
  ],
});
