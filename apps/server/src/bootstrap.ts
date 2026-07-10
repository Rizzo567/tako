// Entry point del server. Avvia il DB embedded (se EMBEDDED_DB=1) impostando
// DATABASE_URL, poi avvia il server. Il client Drizzle è lazy (legge DATABASE_URL
// alla prima query), quindi l'import statico di ./index.js è sicuro: nessuna
// connessione parte prima che il DB sia pronto. Import statici = bundle-friendly.
import { join } from 'node:path'
import { homedir } from 'node:os'
import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs'
import { randomBytes } from 'node:crypto'
import { maybeStartEmbeddedDb } from '@tako/db/embedded'
import { startServer } from './index.js'

// Bonifica del server NODE orfano: se la shell Tauri è morta per crash/force-quit,
// il node figlio (che tiene :4317/:3002) viene reparentato a launchd e resta vivo.
// Al rilancio successivo il nuovo node non riuscirebbe a bindare :4317 (EADDRINUSE)
// e uscirebbe → appliance rotta. Qui, PRIMA di avviare il DB, terminiamo l'orfano
// del run precedente via pidfile (stesso modello di healStaleLock per Postgres).
// Il plugin single-instance di Tauri copre il doppio-avvio NORMALE; questo copre il
// caso post-crash in cui i figli sopravvivono senza un padre vivo.
async function reclaimOrphanServer(home: string): Promise<void> {
  const pidFile = join(home, 'server.pid')
  try {
    if (existsSync(pidFile)) {
      const pid = parseInt((readFileSync(pidFile, 'utf8').split('\n')[0] ?? '').trim(), 10)
      const alive = (p: number) => { try { process.kill(p, 0); return true } catch { return false } }
      if (Number.isInteger(pid) && pid > 1 && pid !== process.pid && alive(pid)) {
        console.log(`[srv] server orfano precedente (pid ${pid}), lo termino`)
        try { process.kill(pid, 'SIGTERM') } catch { /* ignore */ }
        for (let i = 0; i < 8 && alive(pid); i++) await new Promise((r) => setTimeout(r, 300))
        if (alive(pid)) { try { process.kill(pid, 'SIGKILL') } catch { /* ignore */ } }
      }
    }
    writeFileSync(pidFile, String(process.pid), { mode: 0o600 })
    const cleanup = () => { try { if (readFileSync(pidFile, 'utf8').trim() === String(process.pid)) unlinkSync(pidFile) } catch { /* ok */ } }
    process.once('exit', cleanup)
    process.once('SIGTERM', cleanup)
    process.once('SIGINT', cleanup)
  } catch { /* best-effort: non deve mai bloccare l'avvio */ }
}

// Segreto JWT auto-provvisionato e persistente: l'app desktop non deve chiederlo.
// Stabile tra i riavvii (le sessioni sopravvivono). TAKO_HOME è impostato dalla
// shell Tauri (app-data utente); fallback ~/.tako.
if (!process.env['JWT_SECRET']) {
  const home = process.env['TAKO_HOME'] ?? join(homedir(), '.tako')
  mkdirSync(home, { recursive: true })
  const f = join(home, 'jwt-secret')
  if (existsSync(f)) {
    process.env['JWT_SECRET'] = readFileSync(f, 'utf8').trim()
  } else {
    const s = randomBytes(48).toString('hex')
    writeFileSync(f, s, { mode: 0o600 })
    process.env['JWT_SECRET'] = s
  }
}

// Chiave Groq (import-da-testo AI) persistente: nell'app desktop l'env non è
// caricato da .env, quindi come per JWT la leggiamo da un file in TAKO_HOME.
// Precedenza all'env (dev con --env-file o launchd); fallback al file.
if (!process.env['GROQ_API_KEY']) {
  const home = process.env['TAKO_HOME'] ?? join(homedir(), '.tako')
  mkdirSync(home, { recursive: true })
  const gf = join(home, 'groq-key')
  if (existsSync(gf)) {
    const k = readFileSync(gf, 'utf8').trim()
    if (k) process.env['GROQ_API_KEY'] = k
  }
}

// Termina l'eventuale server orfano PRIMA di avviare DB e HTTP (libera :4317).
await reclaimOrphanServer(process.env['TAKO_HOME'] ?? join(homedir(), '.tako'))

await maybeStartEmbeddedDb()
await startServer()
