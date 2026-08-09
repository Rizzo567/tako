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
import { rmSync, mkdirSync, cpSync, existsSync, statSync, readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gzipSync, brotliCompressSync, constants as zlibConstants } from 'node:zlib'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const src = join(root, 'apps', 'dashboard', 'owner-src')
const out = join(root, 'apps', 'dashboard', 'public', 'owner')
const icons = join(root, 'apps', 'dashboard', 'public', 'icons')
const staffFonts = join(root, 'apps', 'dashboard', 'public', 'staff', 'fonts')

// I due woff2 (variabili, subset latin) che portano l'identità tipografica di Tako.
// Sono gli STESSI file della dashboard staff, rinominati in modo leggibile: se un
// giorno la staff cambia font, questa mappa è l'unico punto da aggiornare.
const FONTS = {
  'dm-sans.woff2': '330da2a2-35b5-4ed3-b4a5-cc50326c5a41.woff2',
  'nunito.woff2': '6c6c6d55-52ec-4e1a-8a7a-d99f3b2e3f36.woff2',
}

// Budget del bundle JS. È la differenza fra un'app usabile in 4G attraverso un tunnel
// e una che non lo è: se sfora, la build FALLISCE invece di degradare in silenzio.
//
// SOGLIA ALZATA DA 250 A 400 KB IN F2.3 (Exit F0.2, dichiarata — mai in silenzio).
// Misura reale al momento del cambio: 256,6 KB con la UI vera (React 19 + socket.io-client
// + le cinque sezioni). Il salto oltre i 250 KB viene tutto da `socket.io-client`, che è
// il realtime dell'app: senza, la sala non è live e l'app perde la sua ragione d'essere.
//
// Il numero che conta davvero su 4G non è però il byte-count grezzo, ma quello SUL FILO:
// il server serve /owner/ con preCompressed, quindi il browser scarica `app.js.br`. Per
// questo il gate è ora DOPPIO e quello stretto è il secondo:
//   - grezzo   ≤ 400 KB  (tempo di parse sul telefono)
//   - brotli   ≤ 100 KB  (tempo di rete: ~0,5 s su Fast 3G)
// Il gate sul brotli è più severo del vecchio 250 KB grezzo, non più permissivo.
const BUDGET_KB = 400
const BUDGET_BR_KB = 100

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
  // I woff2 restano riferimenti relativi: la build li copia già in /owner/fonts/ e
  // NON devono finire inline nel CSS (in base64 costerebbero un terzo in più e
  // bloccherebbero il primo paint, che è esattamente ciò che font-display evita).
  external: ['*.woff2'],
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

// 3b) Font: solo i due subset latin usati dai token (vedi owner-src/fonts.css).
console.log('▶ copia font (subset latin)')
mkdirSync(join(out, 'fonts'), { recursive: true })
for (const [dest, source] of Object.entries(FONTS)) {
  const from = join(staffFonts, source)
  if (!existsSync(from)) throw new Error(`font mancante: ${from} (mappa FONTS in questo script)`)
  cpSync(from, join(out, 'fonts', dest))
}

// 3c) Pre-compressione. Il server registra /owner/ con `preCompressed: true`, quindi
// serve `app.js.br` a chi accetta brotli senza comprimere nulla a runtime. È LA misura
// che rende l'app usabile in 4G attraverso un tunnel: un bundle React da ~200 KB
// diventa ~60 KB sul filo. Niente dipendenze nuove: brotli e gzip sono in node:zlib.
console.log('▶ pre-compressione (br + gz)')
const compressible = ['app.js', 'app.css', 'index.html', 'manifest.webmanifest', 'sw.js']
const compressed = {}
for (const f of compressible) {
  const buf = readFileSync(join(out, f))
  const br = brotliCompressSync(buf, {
    params: {
      [zlibConstants.BROTLI_PARAM_QUALITY]: 11,
      [zlibConstants.BROTLI_PARAM_SIZE_HINT]: buf.length,
    },
  })
  const gz = gzipSync(buf, { level: 9 })
  writeFileSync(join(out, `${f}.br`), br)
  writeFileSync(join(out, `${f}.gz`), gz)
  compressed[f] = br.length
}

// 4) Verifica: il gate sta nella build, non in un controllo manuale a valle.
const jsBytes = statSync(join(out, 'app.js')).size
const cssBytes = statSync(join(out, 'app.css')).size
const jsKb = jsBytes / 1024
console.log(`  app.js  ${jsKb.toFixed(1)} KB (budget ${BUDGET_KB} KB) → ${(compressed['app.js'] / 1024).toFixed(1)} KB in brotli`)
console.log(`  app.css ${(cssBytes / 1024).toFixed(1)} KB → ${(compressed['app.css'] / 1024).toFixed(1)} KB in brotli`)

const jsBrKb = compressed['app.js'] / 1024
if (jsKb > BUDGET_KB) {
  throw new Error(
    `app.js ${jsKb.toFixed(1)} KB supera il budget di ${BUDGET_KB} KB (grezzo). ` +
    'Rimedi in ordine: code-splitting con import() dinamico delle sezioni; alias esbuild verso ' +
    'preact/compat; solo come ultima risorsa alzare BUDGET_KB DOCUMENTANDO la misura reale.',
  )
}
if (jsBrKb > BUDGET_BR_KB) {
  throw new Error(
    `app.js ${jsBrKb.toFixed(1)} KB in brotli supera il budget di ${BUDGET_BR_KB} KB (sul filo). ` +
    'È il gate che protegge il TTI su 4G: prima di alzarlo, misura con scripts/test-owner-shell.mjs.',
  )
}

for (const f of ['index.html', 'app.js', 'app.css', 'app.js.br', 'app.css.br', 'sw.js', 'manifest.webmanifest', 'icons', 'fonts/dm-sans.woff2', 'fonts/nunito.woff2']) {
  if (!existsSync(join(out, f))) throw new Error(`output mancante: ${f}`)
}

console.log('✓ app owner pronta:', out)
