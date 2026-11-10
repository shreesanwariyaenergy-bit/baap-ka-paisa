import { existsSync } from 'node:fs';
import { defineConfig, devices } from '@playwright/test';

// The "live" project runs only when Supabase settings are present (e.g. in .env.local) and checks the
// real database's empty state. It never writes to the database.
const live = Boolean(process.env.SUPABASE_URL) || existsSync('.env.local');

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
    ...(live ? [{ name: 'live', testMatch: /unavailable\.spec/, use: { ...devices['Desktop Chrome'], baseURL: 'http://localhost:3202' } }] : []),
  ],
  webServer: [
    { command: 'npx next start -p 3200', port: 3200, env: { BKP_DATA_SOURCE: 'demo' }, reuseExistingServer: false, timeout: 60_000 },
    { command: 'npx next start -p 3201', port: 3201, env: { BKP_DATA_SOURCE: 'unavailable' }, reuseExistingServer: false, timeout: 60_000 },
    ...(live ? [{ command: 'npx next start -p 3202', port: 3202, env: { BKP_DATA_SOURCE: 'supabase', NODE_USE_ENV_PROXY: '1' }, reuseExistingServer: false, timeout: 60_000 }] : []),
  ],
});
