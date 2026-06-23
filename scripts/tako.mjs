#!/usr/bin/env node
// Avvio Tako "tutto in uno" senza Tauri: un solo processo server che serve
// API + Socket.io + dashboard staff + Postgres embedded. Ponte verso gli installer
// (F4) per usare Tako subito, senza terminale multiplo né docker.
//
//   pnpm tako            → http://localhost:4317/staff
//
// Cross-platform: nessun env inline shell, tutto via Node spawn.
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { randomBytes } from 'node:crypto'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const serverDir = join(root, 'apps', 'server')

// Segreto JWT persistente in ~/.tako/secret: le sessioni sopravvivono ai riavvii.
const takoHome = join(homedir(), '.tako')
mkdirSync(takoHome, { recursive: true })
const secretFile = join(takoHome, 'jwt-secret')
let secret
if (existsSync(secretFile)) {
  secret = readFileSync(secretFile, 'utf8').trim()
} else {
  secret = randomBytes(48).toString('hex')
  writeFileSync(secretFile, secret, { mode: 0o600 })
}

const port = process.env['PORT'] ?? '4317'
const tsx = join(serverDir, 'node_modules', '.bin', process.platform === 'win32' ? 'tsx.cmd' : 'tsx')
const entry = join(serverDir, 'src', 'bootstrap.ts')

console.log('▶ Tako in avvio — dashboard su http://localhost:%s/staff', port)

const child = spawn(tsx, [entry], {
  cwd: serverDir,
  stdio: 'inherit',
  env: {
    ...process.env,
    EMBEDDED_DB: '1',
    PORT: port,
    JWT_SECRET: secret,
    NODE_ENV: process.env['NODE_ENV'] ?? 'production',
  },
})

const stop = () => { try { child.kill() } catch {} }
process.on('SIGINT', () => { stop(); process.exit(0) })
process.on('SIGTERM', () => { stop(); process.exit(0) })
child.on('exit', (code) => process.exit(code ?? 0))
