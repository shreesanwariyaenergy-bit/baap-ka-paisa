import { defineConfig, devices } from '@playwright/test';

// Two servers from the same production build: one with demo data, one with no data source connected.
// Build first: BKP_DATA_SOURCE=demo npm run build
export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  reporter: [['list']],
  use: { trace: 'off', baseURL: 'http://localhost:3200' },
  projects: [
    { name: 'demo', testIgnore: /unavailable\.spec/, use: { ...devices['Desktop Chrome'] } },
    { name: 'unavailable', testMatch: /unavailable\.spec/, use: { ...devices['Desktop Chrome'], baseURL: 'http://localhost:3201' } },
  ],
  webServer: [
    { command: 'npx next start -p 3200', port: 3200, env: { BKP_DATA_SOURCE: 'demo' }, reuseExistingServer: false, timeout: 60_000 },
    { command: 'npx next start -p 3201', port: 3201, env: { BKP_DATA_SOURCE: 'unavailable' }, reuseExistingServer: false, timeout: 60_000 },
  ],
});
