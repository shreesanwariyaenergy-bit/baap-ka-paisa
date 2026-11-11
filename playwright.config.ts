import { existsSync } from 'node:fs';
import { defineConfig, devices } from '@playwright/test';

// Servers from one production build: demo data (3200), no data source (3201) and, when Supabase settings
// exist in .env.local, the live database (3202). Live tests never write to the database.
const live = Boolean(process.env.SUPABASE_URL) || existsSync('.env.local');
// Demo visitors are signed out by default; this cookie is what "Continue as the demo member" sets.
const demoMember = { cookies: [{ name: 'bkp_demo_viewer', value: '1', domain: 'localhost', path: '/', expires: -1, httpOnly: true, secure: false, sameSite: 'Lax' as const }], origins: [] };

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  reporter: [['list']],
  use: { trace: 'off', baseURL: 'http://localhost:3200' },
  projects: [
    { name: 'demo', testMatch: /site\.spec/, use: { ...devices['Desktop Chrome'], storageState: demoMember } },
    { name: 'visitor', testMatch: /visitor\.spec/, use: { ...devices['Desktop Chrome'] } },
    { name: 'unavailable', testMatch: /unavailable\.spec/, use: { ...devices['Desktop Chrome'], baseURL: 'http://localhost:3201' } },
    ...(live ? [{ name: 'live', testMatch: /unavailable\.spec/, use: { ...devices['Desktop Chrome'], baseURL: 'http://localhost:3202' } }] : []),
  ],
  webServer: [
    { command: 'npx next start -p 3200', port: 3200, env: { BKP_DATA_SOURCE: 'demo' }, reuseExistingServer: false, timeout: 60_000 },
    { command: 'npx next start -p 3201', port: 3201, env: { BKP_DATA_SOURCE: 'unavailable' }, reuseExistingServer: false, timeout: 60_000 },
    ...(live ? [{ command: 'npx next start -p 3202', port: 3202, env: { BKP_DATA_SOURCE: 'supabase', NODE_USE_ENV_PROXY: '1' }, reuseExistingServer: false, timeout: 60_000 }] : []),
  ],
});
