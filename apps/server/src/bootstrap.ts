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

// Modo CLOUD (control-plane): NON avvia il Postgres embedded locale e non auto-provvisiona
// JWT_SECRET (il cloud usa SESSION_SECRET + CLOUD_DATABASE_URL gestite via env del deploy).
const CLOUD_MODE = (process.env['TAKO_MODE'] ?? 'local').toLowerCase() === 'cloud'

// Segreto JWT auto-provvisionato e persistente: l'app desktop non deve chiederlo.
// Stabile tra i riavvii (le sessioni sopravvivono). TAKO_HOME è impostato dalla
// shell Tauri (app-data utente); fallback ~/.tako.
if (!CLOUD_MODE && !process.env['JWT_SECRET']) {
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

if (!CLOUD_MODE) await maybeStartEmbeddedDb()
await startServer()
