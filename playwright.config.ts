import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: 'apps/web/e2e', use: { baseURL: 'http://127.0.0.1:4173/snu-ieum/', trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { browserName: 'chromium', channel: process.env.PLAYWRIGHT_CHANNEL } }],
  webServer: { command: 'npm run dev -- --host 127.0.0.1 --port 4173', url: 'http://127.0.0.1:4173/snu-ieum/', reuseExistingServer: !process.env.CI }
});
