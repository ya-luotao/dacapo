import { defineConfig } from '@playwright/test';
import { normalURL, scenarioURL } from './tests/browser/servers.ts';

export default defineConfig({
  testDir: './tests/browser',
  testMatch: '**/*.spec.ts',
  workers: 1,
  retries: 0,
  forbidOnly: !!process.env.CI,
  timeout: 45_000,
  globalTimeout: 5 * 60_000,
  expect: { timeout: 10_000 },
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    browserName: 'chromium',
    viewport: { width: 1280, height: 900 },
    locale: 'en-GB',
    timezoneId: 'UTC',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: [
    {
      name: 'ordinary dev',
      command: 'pnpm dev --host 127.0.0.1 --port 5173 --strictPort',
      url: normalURL,
      env: { VITE_SYNC_ENDPOINT: '' },
      reuseExistingServer: false,
    },
    ...['empty', 'progress', 'piece'].map((name) => ({
      name,
      command: `pnpm dev:${name} --host 127.0.0.1`,
      url: scenarioURL(name),
      // These must remain local fixtures even when a sync endpoint is configured.
      env: { VITE_SYNC_ENDPOINT: 'https://sync.invalid' },
      reuseExistingServer: false,
    })),
  ],
});
