import { defineConfig } from '@playwright/test';
const port = Number(process.env.IMAGEWAY_TEST_PORT ?? 4173);
if (!Number.isSafeInteger(port) || port < 1024 || port > 65535)
  throw new Error('IMAGEWAY_TEST_PORT must be an integer between 1024 and 65535.');
const baseURL = `http://127.0.0.1:${port}`;
export default defineConfig({
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
    { name: 'firefox', use: { browserName: 'firefox' } },
    { name: 'webkit', use: { browserName: 'webkit' } },
  ],
  workers: 2,
  testDir: './tests/e2e',
  use: {
    baseURL,
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
    command: `bun run --filter @imageway/example-components preview --port ${port} --strictPort`,
    url: baseURL,
    reuseExistingServer: false,
  },
  reporter: [['list'], ['json', { outputFile: '.local/playwright-results.json' }]],
});
