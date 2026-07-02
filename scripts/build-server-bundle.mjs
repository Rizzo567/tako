#!/usr/bin/env node
// Costruisce il bundle server AUTOSUFFICIENTE impacchettato dentro l'app desktop.
// Strategia: esbuild bundla SOLO il nostro codice (server src + workspace @tako/*,
// che sono sorgenti TS non installabili da npm). Tutti i pacchetti npm restano
// ESTERNI e vengono spediti come node_modules reale → ogni pacchetto conserva i
// suoi file su disco (binari nativi di sharp/Postgres, client-dist di socket.io,
// uso di __dirname, ecc.). Bundlare quei pacchetti li romperebbe.
//
// Output apps/app/src-tauri/resources/server/:
//   server.mjs    — nostro codice bundlato (ESM), importa i pacchetti esterni
//   node_modules/ — dipendenze runtime npm (installazione pulita, no symlink pnpm)
//   migrations/   — migrazioni Drizzle (lette a runtime)
//   staff/        — dashboard statica servita su /staff
//   node          — runtime Node (l'app non richiede Node sul computer target)
import { build } from 'esbuild'
import { execSync } from 'node:child_process'
import { rmSync, mkdirSync, cpSync, writeFileSync, copyFileSync, chmodSync, existsSync, readFileSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execPath } from 'node:process'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const out = join(root, 'apps', 'app', 'src-tauri', 'resources', 'server')

const readPkg = (p) => JSON.parse(readFileSync(join(root, p, 'package.json'), 'utf8'))
const serverPkg = readPkg('apps/server')
const dbPkg = readPkg('packages/db')

// Dipendenze runtime = deps del server + deps del db (es. embedded-postgres),
// esclusi i pacchetti workspace @tako/* (vengono bundlati, non installati).
const runtimeDeps = {}
for (const [name, ver] of Object.entries({ ...dbPkg.dependencies, ...serverPkg.dependencies })) {
  if (name.startsWith('@tako/')) continue
  runtimeDeps[name] = ver
}
const externalNames = [...Object.keys(runtimeDeps), '@embedded-postgres/*']

console.log('▶ pulizia', out)
rmSync(out, { recursive: true, force: true })
mkdirSync(out, { recursive: true })

// 1) Bundle del SOLO nostro codice. Tutto ciò che è npm resta esterno.
console.log('▶ esbuild bundle server.mjs (solo codice nostro; npm esterni)')
await build({
  entryPoints: [join(root, 'apps', 'server', 'src', 'bootstrap.ts')],
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  outfile: join(out, 'server.mjs'),
  external: externalNames,
  banner: { js: 'import{createRequire as __cr}from"module";const require=__cr(import.meta.url);' },
  logLevel: 'warning',
})

// 2) Risorse lette a runtime.
console.log('▶ copia migrations + staff')
cpSync(join(root, 'packages', 'db', 'src', 'migrations'), join(out, 'migrations'), { recursive: true })
cpSync(join(root, 'apps', 'dashboard', 'public', 'staff'), join(out, 'staff'), { recursive: true })

// 2b) App CLIENTE (apps/web, Next standalone): server Node autosufficiente avviato
// come 2° figlio dall'app desktop sulla porta 3002. I clienti aprono il menu via
// QR sulla LAN (http://<IP-LAN-Mac>:3002/r/.../t/...). Senza questo, il QR punta a
// localhost e non funziona dal telefono.
console.log('▶ build app cliente (apps/web, Next standalone)')
execSync('pnpm --filter @tako/web build', {
  cwd: root,
  stdio: 'inherit',
  env: { ...process.env, NEXT_PUBLIC_API_URL: 'http://127.0.0.1:4317' },
})
const webStandalone = join(root, 'apps', 'web', '.next', 'standalone')
if (!existsSync(webStandalone)) {
  throw new Error('apps/web/.next/standalone mancante: output:"standalone" attivo in next.config?')
}
// Output in resources/web (SIBLING di resources/server), come si aspettano
// tauri.conf (resources/web/**/*) e lib.rs (res/resources/web/apps/web/server.js).
const webOut = join(dirname(out), 'web')
rmSync(webOut, { recursive: true, force: true })
console.log('▶ copia web standalone + static + public')
cpSync(webStandalone, webOut, { recursive: true })
cpSync(join(root, 'apps', 'web', '.next', 'static'), join(webOut, 'apps', 'web', '.next', 'static'), { recursive: true })
const webPublic = join(root, 'apps', 'web', 'public')
if (existsSync(webPublic)) cpSync(webPublic, join(webOut, 'apps', 'web', 'public'), { recursive: true })

// FIX pnpm + Next standalone: il bundler Tauri dereferenzia i symlink, così
// apps/web/node_modules/next diventa una dir reale ma le SUE dipendenze interne
// (styled-jsx, @swc/helpers, caniuse-lite, sharp…) — in pnpm gli stanno accanto
// via symlink dentro .pnpm/next@*/node_modules — non lo seguono → "Cannot find
// module 'styled-jsx/package.json'". Le copiamo come dir reali accanto a next.
const pnpmDir = join(webOut, 'node_modules', '.pnpm')
const nextEntry = existsSync(pnpmDir) ? readdirSync(pnpmDir).find((d) => d.startsWith('next@')) : null
if (nextEntry) {
  console.log('▶ appiattisco le dipendenze di next (fix pnpm/standalone)')
  cpSync(join(pnpmDir, nextEntry, 'node_modules'), join(webOut, 'apps', 'web', 'node_modules'), { recursive: true, dereference: true })
} else {
  console.warn('⚠ next@* non trovato in .pnpm: salto il flatten (verifica la web)')
}

// 3) node_modules runtime: installazione pulita (no symlink pnpm).
console.log('▶ npm install dipendenze runtime (~include binari Postgres)')
writeFileSync(
  join(out, 'package.json'),
  JSON.stringify({ name: 'tako-server-bundle', private: true, type: 'module', dependencies: runtimeDeps }, null, 2),
)
execSync('npm install --omit=dev --no-audit --no-fund --loglevel=error', { cwd: out, stdio: 'inherit' })

// 4) Runtime Node impacchettato.
console.log('▶ copia runtime node')
const nodeDest = join(out, 'node')
copyFileSync(execPath, nodeDest)
chmodSync(nodeDest, 0o755)

if (!existsSync(join(out, 'server.mjs'))) throw new Error('server.mjs mancante')
console.log('✓ bundle pronto:', out)
