import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/e2e',
  use: { baseURL: 'http://127.0.0.1:4173', headless: true },
  webServer: { command: 'bun run --filter @imageway/example-components preview --port 4173', url: 'http://127.0.0.1:4173', reuseExistingServer: false },
  reporter: [['list'], ['json', { outputFile: '.local/playwright-results.json' }]],
});
