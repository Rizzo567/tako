// Entry point del server. Avvia il DB embedded (se EMBEDDED_DB=1) impostando
// DATABASE_URL, poi avvia il server. Il client Drizzle è lazy (legge DATABASE_URL
// alla prima query), quindi l'import statico di ./index.js è sicuro: nessuna
// connessione parte prima che il DB sia pronto. Import statici = bundle-friendly.
import { join } from 'node:path'
import { homedir } from 'node:os'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { randomBytes } from 'node:crypto'
import { maybeStartEmbeddedDb } from '@tako/db/embedded'
import { startServer } from './index.js'

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

await maybeStartEmbeddedDb()
await startServer()
