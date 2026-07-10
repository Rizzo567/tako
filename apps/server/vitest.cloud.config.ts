import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

// Config DEDICATA ai test del control-plane cloud (FASE 5c).
// - root = apps/server: i bare import (fastify, @fastify/*, drizzle-orm, postgres, @tako/db)
//   risolvono dal node_modules del workspace server.
// - `embedded-postgres` vive solo in packages/db/node_modules → alias esplicito.
// - serial + fork: ogni file di test ha il suo Postgres effimero e le sue env cloud.
const here = dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  test: {
    root: here,
    include: ['tests/cloud/**/*.test.ts'],
    testTimeout: 60000,
    hookTimeout: 90000,
    fileParallelism: false,
    pool: 'forks',
  },
  resolve: {
    alias: {
      'embedded-postgres': join(here, '..', '..', 'packages', 'db', 'node_modules', 'embedded-postgres'),
    },
  },
})
