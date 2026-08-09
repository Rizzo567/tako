#!/usr/bin/env node
// Costruisce l'app owner (PWA mobile del ristoratore) da apps/dashboard/owner-src/
// verso apps/dashboard/public/owner/, che Fastify serve su /owner/ (OWNER_DIR in
// apps/server/src/index.ts) e che build-server-bundle.mjs impacchetta nell'app desktop.
//
// Perché una pipeline e non lo stesso schema della staff: la SPA staff carica React
// UMD + Babel standalone (4.3 MB) e compila 12 file JSX NEL BROWSER a ogni avvio.
// Sul telefono in 4G è inaccettabile. Qui si compila a build-time: zero Babel a runtime.
//
// Output apps/dashboard/public/owner/:
//   index.html           — copiato da owner-src (nessun <script type="text/babel">)
//   app.js               — bundle React minificato (soglia: BUDGET_KB)
//   app.css              — token + shell, @import risolti da esbuild
//   sw.js                — service worker, scope /owner/
//   manifest.webmanifest — start_url e scope /owner/
//   icons/               — copia locale delle icone (devono stare DENTRO lo scope)
import { build } from 'esbuild'
import { rmSync, mkdirSync, cpSync, existsSync, statSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const src = join(root, 'apps', 'dashboard', 'owner-src')
const out = join(root, 'apps', 'dashboard', 'public', 'owner')
const icons = join(root, 'apps', 'dashboard', 'public', 'icons')

// Budget del bundle JS. È la differenza fra un'app usabile in 4G attraverso un tunnel
// e una che non lo è: se sfora, la build FALLISCE invece di degradare in silenzio.
const BUDGET_KB = 250

if (!existsSync(src)) throw new Error(`owner-src mancante: ${src}`)

console.log('▶ pulizia', out)
rmSync(out, { recursive: true, force: true })
mkdirSync(out, { recursive: true })

// 1) JS. Bundle completo (React incluso): niente UMD di sviluppo, niente CDN — l'app
// deve funzionare anche con l'appliance senza internet.
console.log('▶ esbuild app.js')
await build({
  entryPoints: [join(src, 'main.tsx')],
  bundle: true,
  minify: true,
  format: 'iife',
  platform: 'browser',
  target: ['es2020', 'safari15'],
  jsx: 'automatic',
  // Senza questo react-dom resta in modalità development (più grande e più lento).
  define: { 'process.env.NODE_ENV': '"production"' },
  outfile: join(out, 'app.js'),
  legalComments: 'none',
  logLevel: 'warning',
})

// 2) CSS. Entry separata (non importata dal TS) così il typecheck della dashboard non
// deve conoscere i moduli .css; esbuild risolve gli @import e minifica.
console.log('▶ esbuild app.css')
await build({
  entryPoints: [join(src, 'app.css')],
  bundle: true,
  minify: true,
  outfile: join(out, 'app.css'),
  logLevel: 'warning',
})

// 3) File statici copiati verbatim.
console.log('▶ copia index.html + sw.js + manifest + icone')
for (const f of ['index.html', 'sw.js', 'manifest.webmanifest']) {
  cpSync(join(src, f), join(out, f))
}
// Le icone vanno DENTRO /owner/: un manifest con scope /owner/ non deve dipendere da
// risorse fuori scope, e Fastify serve solo le sottocartelle registrate (staff/, owner/).
cpSync(icons, join(out, 'icons'), { recursive: true })

// 4) Verifica: il gate sta nella build, non in un controllo manuale a valle.
const jsBytes = statSync(join(out, 'app.js')).size
const cssBytes = statSync(join(out, 'app.css')).size
const jsKb = jsBytes / 1024
console.log(`  app.js  ${jsKb.toFixed(1)} KB (budget ${BUDGET_KB} KB)`)
console.log(`  app.css ${(cssBytes / 1024).toFixed(1)} KB`)

if (jsKb > BUDGET_KB) {
  throw new Error(
    `app.js ${jsKb.toFixed(1)} KB supera il budget di ${BUDGET_KB} KB. ` +
    'Rimedi in ordine: code-splitting con import() dinamico delle sezioni; alias esbuild verso ' +
    'preact/compat; solo come ultima risorsa alzare BUDGET_KB DOCUMENTANDO la misura reale.',
  )
}

for (const f of ['index.html', 'app.js', 'app.css', 'sw.js', 'manifest.webmanifest', 'icons']) {
  if (!existsSync(join(out, f))) throw new Error(`output mancante: ${f}`)
}

console.log('✓ app owner pronta:', out)
