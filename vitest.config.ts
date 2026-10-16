import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      // Same alias Nuxt gives to code shared between the app and the server.
      '#shared': fileURLToPath(new URL('./shared', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    projects: [
      // Pure code, no I/O (`npm test`).
      { extends: true, test: { name: 'unit', include: ['test/unit/**/*.test.ts'] } },
      // Against the local Supabase stack, reached through `.env` (`npm run test:integration`).
      { extends: true, test: { name: 'integration', include: ['test/integration/**/*.test.ts'], testTimeout: 15_000, hookTimeout: 30_000 } },
    ],
  },
})
