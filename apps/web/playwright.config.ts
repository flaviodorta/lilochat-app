import { defineConfig, devices } from '@playwright/test';

/**
 * Full-stack E2E: Playwright boots the entire Phase-2 stack on dedicated test
 * ports (dev infra from docker/compose.dev.yml must be up). Roadmap 1.9 + 2.12.
 * The YouTube Data API is stubbed (8s videos) — sync assertions come from the
 * offset-corrected position ticker, the same math the player syncs against.
 */
const IDENTITY_PORT = 4111;
const GATEWAY_PORT = 4110;
const ROOMS_PORT = 4112;
const PLAYBACK_PORT = 4113;
const RTG_PORT = 4115;
const YT_STUB_PORT = 4199;
const WEB_PORT = 3010;

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    trace: 'retain-on-failure',
    ...devices['Desktop Chrome'],
  },
  webServer: [
    {
      command: `PORT=${YT_STUB_PORT} node e2e/helpers/youtube-stub.mjs`,
      port: YT_STUB_PORT,
      timeout: 15_000,
      reuseExistingServer: !process.env.CI,
    },
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
      cwd: '../services/rooms',
      url: `http://localhost:${ROOMS_PORT}/health/ready`,
      timeout: 30_000,
      reuseExistingServer: !process.env.CI,
      env: { PORT: String(ROOMS_PORT) },
    },
    {
      command: './node_modules/.bin/tsx src/main.ts',
      cwd: '../services/playback',
      url: `http://localhost:${PLAYBACK_PORT}/health/ready`,
      timeout: 30_000,
      reuseExistingServer: !process.env.CI,
      env: {
        PORT: String(PLAYBACK_PORT),
        YOUTUBE_API_URL: `http://localhost:${YT_STUB_PORT}`,
        YOUTUBE_API_KEY: 'e2e-stub',
        ADVANCE_GRACE_MS: '500',
      },
    },
    {
      command: './node_modules/.bin/tsx src/main.ts',
      cwd: '../realtime-gateway',
      url: `http://localhost:${RTG_PORT}/health/ready`,
      timeout: 30_000,
      reuseExistingServer: !process.env.CI,
      env: { PORT: String(RTG_PORT), CORS_ORIGINS: `http://localhost:${WEB_PORT}` },
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
        ROOMS_SERVICE_URL: `http://localhost:${ROOMS_PORT}`,
        PLAYBACK_SERVICE_URL: `http://localhost:${PLAYBACK_PORT}`,
        CORS_ORIGINS: `http://localhost:${WEB_PORT}`,
      },
    },
    {
      command: `./node_modules/.bin/next dev -p ${WEB_PORT}`,
      url: `http://localhost:${WEB_PORT}`,
      timeout: 60_000,
      reuseExistingServer: !process.env.CI,
      env: {
        NEXT_PUBLIC_API_URL: `http://localhost:${GATEWAY_PORT}`,
        NEXT_PUBLIC_WS_URL: `http://localhost:${RTG_PORT}`,
      },
    },
  ],
});
