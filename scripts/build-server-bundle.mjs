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
import { rmSync, mkdirSync, cpSync, writeFileSync, copyFileSync, chmodSync, existsSync, readFileSync, readdirSync, lstatSync, realpathSync } from 'node:fs'
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
console.log('▶ copia migrations + staff + worker ASR')
cpSync(join(root, 'packages', 'db', 'src', 'migrations'), join(out, 'migrations'), { recursive: true })
cpSync(join(root, 'apps', 'dashboard', 'public', 'staff'), join(out, 'staff'), { recursive: true })
// Worker Python della dettatura (mlx-whisper): asr-local.ts lo cerca accanto
// al bundle (resources/server/asr/asr_worker.py). Il venv sta in ~/.tako.
cpSync(join(root, 'apps', 'server', 'asr'), join(out, 'asr'), { recursive: true })

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
  const nextNm = join(pnpmDir, nextEntry, 'node_modules')
  const webNm = join(webOut, 'apps', 'web', 'node_modules')
  // Alcuni sibling di next (react/react-dom) sono symlink verso il tree di
  // Next standalone, che è POTATO (manca jsx-runtime.js) → dereferenziarli
  // in blocco crasha. Copiamo dep-per-dep: per ogni pacchetto preferiamo la
  // copia COMPLETA dello store .pnpm (dep@ver/node_modules/dep); ricadiamo sul
  // symlink di next solo se lo store non ce l'ha. Le rotte le saltiamo.
  const storeSrc = (dep) => {
    const entry = readdirSync(pnpmDir).find((d) => d.startsWith(dep.replace('/', '+') + '@'))
    if (!entry) return null
    const p = join(pnpmDir, entry, 'node_modules', dep)
    return existsSync(p) ? p : null
  }
  const copyDep = (dep, srcDir) => {
    const dest = join(webNm, dep)
    const src = storeSrc(dep) || join(srcDir, dep)
    try {
      mkdirSync(join(dest, '..'), { recursive: true })
      // il dest può già esistere come symlink potato (da .next/standalone):
      // rimuovilo, altrimenti cpSync fallisce con ERR_FS_CP_DIR_TO_NON_DIR
      rmSync(dest, { recursive: true, force: true })
      cpSync(src, dest, { recursive: true, dereference: true, force: true })
    } catch (e) {
      console.warn(`⚠ flatten: salto ${dep} (${e.code || e.message})`)
    }
  }
  for (const name of readdirSync(nextNm)) {
    if (name.startsWith('@')) {
      for (const sub of readdirSync(join(nextNm, name))) copyDep(`${name}/${sub}`, nextNm)
    } else {
      copyDep(name, nextNm)
    }
  }
} else {
  console.warn('⚠ next@* non trovato in .pnpm: salto il flatten (verifica la web)')
}

// FIX Windows/NSIS: lo store .pnpm NON deve finire nel bundle. Le sue dir hanno
// nomi lunghissimi (next@15.5.15_babel-plugin-react-compiler@…_react@…) che
// sommati al path del runner sfondano MAX_PATH (260): makensis fallisce con
// "File: failed opening file". Prima di eliminarlo materializziamo ogni symlink
// di node_modules/ (root e apps/web) che punta dentro lo store: symlink →
// copia reale COMPLETA presa dallo store (dereference).
if (existsSync(pnpmDir)) {
  console.log('▶ materializzo i symlink pnpm ed elimino lo store .pnpm (fix MAX_PATH/NSIS)')
  const materialize = (nmDir) => {
    if (!existsSync(nmDir)) return
    const entries = readdirSync(nmDir).flatMap((name) => {
      if (name === '.pnpm' || name === '.bin') return []
      if (name.startsWith('@')) return readdirSync(join(nmDir, name)).map((s) => `${name}/${s}`)
      return [name]
    })
    for (const dep of entries) {
      const p = join(nmDir, dep)
      if (!lstatSync(p).isSymbolicLink()) continue
      const real = realpathSync(p)
      rmSync(p, { force: true })
      cpSync(real, p, { recursive: true, dereference: true, force: true })
    }
  }
  materialize(join(webOut, 'node_modules'))
  materialize(join(webOut, 'apps', 'web', 'node_modules'))
  rmSync(pnpmDir, { recursive: true, force: true })
}

// 3) node_modules runtime: installazione pulita (no symlink pnpm).
console.log('▶ npm install dipendenze runtime (~include binari Postgres)')
writeFileSync(
  join(out, 'package.json'),
  JSON.stringify({ name: 'tako-server-bundle', private: true, type: 'module', dependencies: runtimeDeps }, null, 2),
)
execSync('npm install --omit=dev --no-audit --no-fund --loglevel=error', { cwd: out, stdio: 'inherit' })

// 4) Runtime Node impacchettato. In CI il bundle si costruisce SULLA piattaforma
// target (macos-latest / windows-latest), quindi execPath è già il node giusto.
// Su Windows il binario DEVE chiamarsi node.exe: lib.rs lo cerca così.
console.log('▶ copia runtime node')
const nodeName = process.platform === 'win32' ? 'node.exe' : 'node'
const nodeDest = join(out, nodeName)
copyFileSync(execPath, nodeDest)
if (process.platform !== 'win32') chmodSync(nodeDest, 0o755)

if (!existsSync(join(out, 'server.mjs'))) throw new Error('server.mjs mancante')
console.log('✓ bundle pronto:', out)
