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
import { existsSync, readFileSync, unlinkSync, cpSync, mkdirSync, readdirSync, rmSync, statSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { homedir } from 'node:os'
import { createRequire } from 'node:module'

const currentDir = dirname(fileURLToPath(import.meta.url))
const MIGRATIONS_DIR = join(currentDir, 'migrations')

let instance: InstanceType<typeof EmbeddedPostgres> | null = null

// Su Windows con token amministratore ("esegui come amministratore", CI) postgres.exe
// RIFIUTA di partire; pg_ctl invece crea un token ristretto e avvia comunque.
// Se l'avvio diretto fallisce ripieghiamo su pg_ctl: questi flag ricordano come
// abbiamo avviato, perché anche lo stop deve passare da pg_ctl.
let startedViaPgCtl = false
let pgCtlDataDir = ''

/** Path di pg_ctl.exe dentro il pacchetto binario della piattaforma (solo win32). */
function resolvePgCtl(): string {
  // Due hop: i pacchetti espongono solo il main in `exports`, quindi si risolve
  // il main entry e si risale alla root (dist/index.js → root del pacchetto).
  const req = createRequire(import.meta.url)
  const libMain = req.resolve('embedded-postgres')
  const platMain = createRequire(libMain).resolve('@embedded-postgres/windows-x64')
  return join(dirname(dirname(platMain)), 'native', 'bin', 'pg_ctl.exe')
}

/** Spegnimento unificato: pg_ctl se abbiamo avviato via pg_ctl, altrimenti la lib. */
async function stopInstance(pg: InstanceType<typeof EmbeddedPostgres>): Promise<void> {
  if (startedViaPgCtl) {
    execFileSync(resolvePgCtl(), ['-D', pgCtlDataDir, '-m', 'fast', 'stop'], { stdio: 'ignore', timeout: 30000 })
    return
  }
  await pg.stop()
}

/**
 * Se nella data dir c'è un postmaster.pid di un'istanza precedente, termina il
 * processo orfano (se ancora vivo) e rimuove il lock. Sicuro nel nostro modello
 * a istanza singola: un pid presente all'avvio è sempre di un run precedente.
 */
async function healStaleLock(databaseDir: string): Promise<void> {
  const pidFile = join(databaseDir, 'postmaster.pid')
  if (!existsSync(pidFile)) return
  const isAlive = (pid: number) => { try { process.kill(pid, 0); return true } catch { return false } }
  // Difesa da PID-reuse: uccidi SOLO se il processo è davvero un postgres. Tra un
  // crash e il rilancio il vecchio PID potrebbe essere stato riassegnato a un
  // processo estraneo; senza questo check lo ucciamo per errore.
  const isPostgres = (pid: number) => {
    try {
      if (process.platform === 'win32') {
        // Windows non ha `ps`: interroga tasklist per il PID e controlla l'immagine.
        const out = execFileSync('tasklist', ['/FI', `PID eq ${pid}`, '/FO', 'CSV', '/NH'], { encoding: 'utf8', timeout: 2000 })
        return /postgres/i.test(out)
      }
      const comm = execFileSync('ps', ['-p', String(pid), '-o', 'comm='], { encoding: 'utf8', timeout: 2000 })
      return /postgres|postmaster/i.test(comm)
    } catch { return false }
  }
  try {
    const pid = parseInt((readFileSync(pidFile, 'utf8').split('\n')[0] ?? '').trim(), 10)
    if (Number.isInteger(pid) && pid > 1 && isAlive(pid) && isPostgres(pid)) {
      console.log(`[db] trovato Postgres orfano (pid ${pid}), lo termino`)
      try { process.kill(pid, 'SIGTERM') } catch { /* ignore */ }
      for (let i = 0; i < 8 && isAlive(pid); i++) await new Promise((r) => setTimeout(r, 400))
      if (isAlive(pid)) { try { process.kill(pid, 'SIGKILL') } catch { /* ignore */ } }
    }
  } catch { /* best-effort */ }
  try { unlinkSync(pidFile) } catch { /* best-effort */ }
}

// Numero di backup a copia fredda da conservare (rotazione).
const KEEP_BACKUPS = Number(process.env['TAKO_DB_KEEP_BACKUPS'] ?? 5)

/**
 * Backup a COPIA FREDDA della data dir, eseguito all'avvio PRIMA di far partire
 * Postgres (la dir non è in uso → copia consistente; nessun bisogno di pg_dump,
 * che la build embedded non include). Ruota conservando gli ultimi KEEP_BACKUPS.
 * Best-effort: un errore qui non deve mai impedire l'avvio del DB.
 * Restore manuale: chiudi Tako, sostituisci `pgdata` con una cartella `backups/pgdata-*`.
 */
function backupDataDirColdCopy(databaseDir: string): void {
  try {
    if (!existsSync(join(databaseDir, 'PG_VERSION'))) return // niente da salvare (dir fresca)
    if (process.env['TAKO_DB_BACKUP'] === '0' || KEEP_BACKUPS <= 0) return
    const backupsRoot = join(dirname(databaseDir), 'backups')
    mkdirSync(backupsRoot, { recursive: true })
    // timestamp ordinabile YYYYMMDD-HHMMSS (senza Date.now: uso ISO locale)
    const d = new Date()
    const p = (n: number) => String(n).padStart(2, '0')
    const ts = `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`
    const dest = join(backupsRoot, `pgdata-${ts}`)
    // salta il file di lock (non serve nel backup) copiando la dir e rimuovendolo dopo
    cpSync(databaseDir, dest, { recursive: true })
    try { unlinkSync(join(dest, 'postmaster.pid')) } catch { /* ok */ }
    console.log(`[db] backup a copia fredda: ${dest}`)
    // rotazione: tieni solo gli ultimi KEEP_BACKUPS
    const dirs = readdirSync(backupsRoot)
      .filter((n) => n.startsWith('pgdata-'))
      .map((n) => ({ n, t: statSync(join(backupsRoot, n)).mtimeMs }))
      .sort((a, b) => b.t - a.t)
    for (const old of dirs.slice(KEEP_BACKUPS)) {
      try { rmSync(join(backupsRoot, old.n), { recursive: true, force: true }) } catch { /* ok */ }
    }
  } catch (e) {
    console.log('[db] backup saltato:', (e as Error).message)
  }
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

  // Backup a copia fredda PRIMA di avviare Postgres: la dir non è ancora in uso,
  // quindi la copia è consistente. Recovery = sostituisci pgdata con un backup.
  backupDataDirColdCopy(databaseDir)

  // --encoding=UTF8 esplicito: su Windows initdb erediterebbe la codepage del
  // sistema (es. WIN1252) e qualsiasi carattere fuori codepage (emoji nel menù,
  // '→' nelle migrazioni) farebbe errore 22P05. Su mac/linux è già il default.
  const pg = new EmbeddedPostgres({ databaseDir, user, password, port, persistent: true, initdbFlags: ['--encoding=UTF8'] })
  instance = pg

  const fresh = !existsSync(join(databaseDir, 'PG_VERSION'))
  if (fresh) {
    console.log('[db] inizializzo Postgres embedded in', databaseDir)
    await pg.initialise()
  }
  try {
    await pg.start()
  } catch (e) {
    if (process.platform !== 'win32') throw e
    // Token elevato: riprova via pg_ctl (vedi commento su startedViaPgCtl).
    console.log('[db] avvio diretto fallito, riprovo via pg_ctl:', (e as Error).message)
    pgCtlDataDir = databaseDir
    execFileSync(resolvePgCtl(), ['-D', databaseDir, '-o', `-p ${port}`, '-l', join(databaseDir, 'pg_ctl.log'), '-w', 'start'], { stdio: 'inherit', timeout: 60000 })
    startedViaPgCtl = true
  }
  console.log(`[db] Postgres embedded in ascolto su 127.0.0.1:${port}`)

  // Handler di shutdown registrati SUBITO dopo start() (prima di createDatabase/migrate):
  // se una fase successiva fallisce e il processo esce, Postgres viene comunque fermato e
  // non resta un'istanza orfana che tiene la data dir + postmaster.pid stantio.
  const stop = async () => {
    try { await stopInstance(pg) } catch { /* best-effort */ }
  }
  process.once('SIGINT', async () => { await stop(); process.exit(0) })
  process.once('SIGTERM', async () => { await stop(); process.exit(0) })
  process.once('beforeExit', stop)

  if (fresh) {
    try {
      if (startedViaPgCtl) {
        // pg.createDatabase esige il processo figlio della lib (qui assente):
        // crea il db via client SQL sul db di sistema.
        const admin = postgres(`postgresql://${user}:${password}@127.0.0.1:${port}/postgres`, { max: 1 })
        try { await admin.unsafe(`CREATE DATABASE "${database}"`) } finally { await admin.end() }
      } else {
        await pg.createDatabase(database)
      }
      console.log(`[db] database "${database}" creato`)
    } catch (e) {
      console.log('[db] createDatabase saltato:', (e as Error).message)
    }
  }

  // Allinea la connection string al DB embedded (host loopback esplicito).
  const url = `postgresql://${user}:${password}@127.0.0.1:${port}/${database}`
  process.env['DATABASE_URL'] = url

  // Migrazioni idempotenti: drizzle traccia quelle già applicate. Se falliscono, chiudi
  // Postgres PRIMA di rilanciare, così un fallimento di migrate() non lascia il DB orfano
  // (gli handler di shutdown sono già registrati sopra, ma qui spegniamo in modo esplicito).
  const migrationClient = postgres(url, { max: 1 })
  try {
    await migrate(drizzle(migrationClient), { migrationsFolder: MIGRATIONS_DIR })
    console.log('[db] migrazioni applicate')
  } catch (err) {
    console.error('[db] migrazioni fallite, spengo Postgres embedded:', (err as Error)?.message ?? err)
    try { await migrationClient.end() } catch { /* best-effort */ }
    try { await stopInstance(pg) } catch { /* best-effort */ }
    instance = null
    throw err
  } finally {
    try { await migrationClient.end() } catch { /* best-effort */ }
  }
}

/** Ferma il Postgres embedded (se attivo). Per spegnimento esplicito/test. */
export async function stopEmbeddedDb(): Promise<void> {
  if (!instance) return
  try { await stopInstance(instance) } catch { /* best-effort */ }
  instance = null
}
