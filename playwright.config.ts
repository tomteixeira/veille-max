import { existsSync } from 'node:fs'
import { defineConfig, devices } from '@playwright/test'
import { INVITED_TRAVELLER_STATE } from './test/e2e/support/travellers'

// `E2E_PORT` lets two checkouts (git worktrees) run their tests side by side.
const PORT = Number(process.env.E2E_PORT ?? 3100)
const baseURL = `http://localhost:${PORT}`
const isCI = !!process.env.CI

// The tests reach the local stack (admin API, mail catcher) with the app's own settings.
if (existsSync('.env')) process.loadEnvFile('.env')

// The app is used on an iPhone first.
const iPhone = { ...devices['iPhone 15'], browserName: 'chromium' } as const

/**
 * End-to-end tests (spec, Testing Decisions, seam 3) run against a production
 * build of the app, connected to the local Supabase stack through `.env`
 * (`npm run supabase:start && npm run supabase:env`).
 */
export default defineConfig({
  testDir: './test/e2e',
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  reporter: isCI ? [['github'], ['html', { open: 'never' }]] : [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL,
    locale: 'fr-FR',
    timezoneId: 'Europe/Paris',
    trace: 'on-first-retry',
  },
  projects: [
    // Signs the seeded invited traveller in once, through the sign-in screen.
    { name: 'setup', testMatch: /\.setup\.ts$/, use: iPhone },
    // Every test starts signed in as that traveller, unless it sets its own `storageState`.
    { name: 'mobile', use: { ...iPhone, storageState: INVITED_TRAVELLER_STATE }, dependencies: ['setup'] },
  ],
  webServer: {
    command: `npm run build && npx nuxt preview --port ${PORT}`,
    url: baseURL,
    reuseExistingServer: !isCI,
    timeout: 240_000,
    stdout: 'pipe',
    // The tick endpoint refuses every call while no secret is set: give it one to check.
    // The notification settings need a VAPID public key to subscribe with; pushes are never sent.
    env: {
      NUXT_TICK_SECRET: 'e2e-tick-secret',
      NUXT_PUBLIC_VAPID_PUBLIC_KEY: 'BHnAoDkLMDLXCUEj6QmqmLkIBX4j3XA1_Dc1kLjronDF3UKllTVkHP8gPiBZY4nSBWl0tyN3hjp-GrOtGhTJAEI',
    },
  },
})
