import { defineConfig } from 'vitest/config'

// Test di integrazione: girano contro lo stack dev vivo (server :3001 + Postgres).
// Avvia prima `pnpm dev` (o almeno server + DB), poi `pnpm test`.
export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    testTimeout: 20000,
    hookTimeout: 30000,
    fileParallelism: false,
    pool: 'forks',
  },
})
