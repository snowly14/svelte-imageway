import { defineConfig } from '@playwright/test';
export default defineConfig({
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
    { name: 'firefox', use: { browserName: 'firefox' } },
    { name: 'webkit', use: { browserName: 'webkit' } },
  ],
  workers: 2,
  testDir: './tests/e2e',
  use: {
    baseURL: 'http://127.0.0.1:4173',
    headless: true,
    ...(process.env.IMAGEWAY_BROWSER_WS
      ? {
          connectOptions: {
            wsEndpoint: process.env.IMAGEWAY_BROWSER_WS,
            exposeNetwork: '<loopback>',
          },
        }
      : {}),
  },
  webServer: {
    command: 'bun run --filter @imageway/example-components preview --port 4173',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: false,
  },
  reporter: [['list'], ['json', { outputFile: '.local/playwright-results.json' }]],
});
