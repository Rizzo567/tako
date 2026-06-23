// Postgres EMBEDDED avviato dal processo server: "apri l'app → DB pronto".
// Avvia un'istanza Postgres portatile come processo figlio, applica le migrazioni
// in modo idempotente e la spegne all'uscita. Attivo solo con EMBEDDED_DB=1
// (nel bundle desktop); in dev puro si usa pg-portable.mjs o docker-compose.
//
// IMPORTANTE: questo modulo NON importa il client Drizzle (./client) per non
// creare la connessione prima che il DB sia in ascolto. Usa un client postgres
// dedicato solo per le migrazioni e lo chiude subito.
import EmbeddedPostgres from 'embedded-postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { existsSync, readFileSync, unlinkSync } from 'node:fs'
import { homedir } from 'node:os'

const currentDir = dirname(fileURLToPath(import.meta.url))
const MIGRATIONS_DIR = join(currentDir, 'migrations')

let instance: InstanceType<typeof EmbeddedPostgres> | null = null

/**
 * Se nella data dir c'è un postmaster.pid di un'istanza precedente, termina il
 * processo orfano (se ancora vivo) e rimuove il lock. Sicuro nel nostro modello
 * a istanza singola: un pid presente all'avvio è sempre di un run precedente.
 */
async function healStaleLock(databaseDir: string): Promise<void> {
  const pidFile = join(databaseDir, 'postmaster.pid')
  if (!existsSync(pidFile)) return
  const isAlive = (pid: number) => { try { process.kill(pid, 0); return true } catch { return false } }
  try {
    const pid = parseInt((readFileSync(pidFile, 'utf8').split('\n')[0] ?? '').trim(), 10)
    if (Number.isInteger(pid) && pid > 1 && isAlive(pid)) {
      console.log(`[db] trovato Postgres orfano (pid ${pid}), lo termino`)
      try { process.kill(pid, 'SIGTERM') } catch { /* ignore */ }
      for (let i = 0; i < 8 && isAlive(pid); i++) await new Promise((r) => setTimeout(r, 400))
      if (isAlive(pid)) { try { process.kill(pid, 'SIGKILL') } catch { /* ignore */ } }
    }
  } catch { /* best-effort */ }
  try { unlinkSync(pidFile) } catch { /* best-effort */ }
}

/**
 * Avvia Postgres embedded se EMBEDDED_DB=1, altrimenti no-op (DB esterno).
 * Idempotente: se già avviato non fa nulla. Imposta DATABASE_URL e applica le
 * migrazioni prima di restituire il controllo.
 */
export async function maybeStartEmbeddedDb(): Promise<void> {
  if (process.env['EMBEDDED_DB'] !== '1') return
  if (instance) return

  // Porta Tako-specifica di default: non si scontra con altri Postgres su 5432.
  // Irrilevante per i client perché qui sotto impostiamo DATABASE_URL esplicitamente.
  const port = Number(process.env['PGPORT'] ?? 54317)
  const user = process.env['PGUSER'] ?? 'tako'
  const password = process.env['PGPASSWORD'] ?? 'tako'
  const database = process.env['PGDATABASE'] ?? 'takodb'
  // Data dir persistente in app-data utente (fuori dal repo, sopravvive agli update).
  const databaseDir = process.env['PGDATA_DIR'] ?? join(homedir(), '.tako', 'pgdata')

  // Auto-guarigione: se un'istanza precedente è stata uccisa male (es. l'app chiusa
  // con SIGKILL), può restare un postgres ORFANO che tiene la data dir + un
  // postmaster.pid stantio → l'avvio fallirebbe con "lock file already exists".
  // Qui terminiamo l'eventuale orfano e ripuliamo il lock prima di partire.
  await healStaleLock(databaseDir)

  const pg = new EmbeddedPostgres({ databaseDir, user, password, port, persistent: true })
  instance = pg

  const fresh = !existsSync(join(databaseDir, 'PG_VERSION'))
  if (fresh) {
    console.log('[db] inizializzo Postgres embedded in', databaseDir)
    await pg.initialise()
  }
  await pg.start()
  console.log(`[db] Postgres embedded in ascolto su 127.0.0.1:${port}`)

  if (fresh) {
    try {
      await pg.createDatabase(database)
      console.log(`[db] database "${database}" creato`)
    } catch (e) {
      console.log('[db] createDatabase saltato:', (e as Error).message)
    }
  }

  // Allinea la connection string al DB embedded (host loopback esplicito).
  const url = `postgresql://${user}:${password}@127.0.0.1:${port}/${database}`
  process.env['DATABASE_URL'] = url

  // Migrazioni idempotenti: drizzle traccia quelle già applicate.
  const migrationClient = postgres(url, { max: 1 })
  try {
    await migrate(drizzle(migrationClient), { migrationsFolder: MIGRATIONS_DIR })
    console.log('[db] migrazioni applicate')
  } finally {
    await migrationClient.end()
  }

  const stop = async () => {
    try { await pg.stop() } catch { /* best-effort */ }
  }
  process.once('SIGINT', async () => { await stop(); process.exit(0) })
  process.once('SIGTERM', async () => { await stop(); process.exit(0) })
  process.once('beforeExit', stop)
}

/** Ferma il Postgres embedded (se attivo). Per spegnimento esplicito/test. */
export async function stopEmbeddedDb(): Promise<void> {
  if (!instance) return
  try { await instance.stop() } catch { /* best-effort */ }
  instance = null
}
