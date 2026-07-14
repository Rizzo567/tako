// Postgres portatile per dev locale (no brew, no docker).
// Avvia un'istanza Postgres su :5432 con creds tako/tako e db takodb,
// poi resta vivo finché non ricevi SIGINT/SIGTERM.
import EmbeddedPostgres from 'embedded-postgres'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { execFileSync } from 'node:child_process'

const __dirname = dirname(fileURLToPath(import.meta.url))
const databaseDir = join(__dirname, '.pgdata')
const isWin = process.platform === 'win32'

const pg = new EmbeddedPostgres({
  databaseDir,
  user: 'tako',
  password: 'tako',
  port: 5432,
  persistent: true,
})

// Risolve pg_ctl.exe dentro il pacchetto nativo, con due hop di createRequire:
// pg-portable → embedded-postgres → @embedded-postgres/windows-x64.
// I pacchetti espongono solo il main via "exports", quindi si risolve il main
// (dist/index.js) e si risale alla root del pacchetto, non package.json.
function resolvePgCtl() {
  const req0 = createRequire(import.meta.url)
  const epMain = req0.resolve('embedded-postgres')
  const req1 = createRequire(epMain)
  const nativeMain = req1.resolve('@embedded-postgres/windows-x64')
  const nativeRoot = dirname(dirname(nativeMain))
  return join(nativeRoot, 'native', 'bin', 'pg_ctl.exe')
}

const fresh = !existsSync(join(databaseDir, 'PG_VERSION'))

if (fresh) {
  console.log('[pg] initialise data dir...')
  // initialise() (initdb con --auth + --pwfile) funziona anche da token admin:
  // il cluster nasce già con l'utente tako superuser e la password giusta.
  await pg.initialise()
}

if (isWin) {
  // Da token admin elevato (CI GitHub, "esegui come amministratore") postgres.exe
  // spawnato direttamente rifiuta di partire. pg_ctl crea un token ristretto e
  // avvia il server: quindi su win32 NON usiamo pg.start(), avviamo con pg_ctl.
  const pgctl = resolvePgCtl()
  const logfile = join(databaseDir, 'pg_ctl.log')
  execFileSync(pgctl, ['-D', databaseDir, '-o', '-p 5432', '-l', logfile, '-w', 'start'], {
    stdio: 'inherit',
  })
  console.log('[pg] started on 127.0.0.1:5432 (pg_ctl)')
} else {
  await pg.start()
  console.log('[pg] started on 127.0.0.1:5432')
}

if (fresh) {
  try {
    if (isWin) {
      // createDatabase() della lib richiede this.process (settato solo da pg.start),
      // che su win32 non usiamo: creiamo il db con un client 'postgres' via TCP
      // connesso al db di sistema 'postgres' come tako.
      const postgres = (await import('postgres')).default
      const sql = postgres({
        host: '127.0.0.1',
        port: 5432,
        user: 'tako',
        password: 'tako',
        database: 'postgres',
      })
      try {
        await sql.unsafe('CREATE DATABASE takodb')
      } finally {
        await sql.end({ timeout: 5 })
      }
    } else {
      await pg.createDatabase('takodb')
    }
    console.log('[pg] database takodb created')
  } catch (e) {
    console.log('[pg] createDatabase skipped:', e.message)
  }
}

const shutdown = async () => {
  console.log('\n[pg] stopping...')
  try {
    if (isWin) {
      // Stop pulito via pg_ctl (coerente con l'avvio); -m fast chiude subito.
      const pgctl = resolvePgCtl()
      execFileSync(pgctl, ['-D', databaseDir, '-m', 'fast', 'stop'], { stdio: 'inherit' })
    } else {
      await pg.stop()
    }
  } catch { /* già fermo */ }
  process.exit(0)
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
console.log('[pg] ready. Ctrl-C to stop.')
