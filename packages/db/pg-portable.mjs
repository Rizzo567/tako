// Postgres portatile per dev locale (no brew, no docker).
// Avvia un'istanza Postgres su :5432 con creds tako/tako e db takodb,
// poi resta vivo finché non ricevi SIGINT/SIGTERM.
import EmbeddedPostgres from 'embedded-postgres'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const databaseDir = join(__dirname, '.pgdata')

const pg = new EmbeddedPostgres({
  databaseDir,
  user: 'tako',
  password: 'tako',
  port: 5432,
  persistent: true,
})

const fresh = await (async () => {
  const { existsSync } = await import('node:fs')
  return !existsSync(join(databaseDir, 'PG_VERSION'))
})()

if (fresh) {
  console.log('[pg] initialise data dir...')
  await pg.initialise()
}

await pg.start()
console.log('[pg] started on 127.0.0.1:5432')

if (fresh) {
  try {
    await pg.createDatabase('takodb')
    console.log('[pg] database takodb created')
  } catch (e) {
    console.log('[pg] createDatabase skipped:', e.message)
  }
}

const shutdown = async () => {
  console.log('\n[pg] stopping...')
  try { await pg.stop() } catch { /* già fermo */ }
  process.exit(0)
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
console.log('[pg] ready. Ctrl-C to stop.')
