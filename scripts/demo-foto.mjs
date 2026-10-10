// Aggancia le FOTO ai piatti del menu demo, da una cartella di immagini.
//
// A cosa serve: in demo un menu senza foto sembra un prototipo. Le foto AI di Tako
// richiedono una chiave Gemini in TAKO_HOME/gemini-key.txt (+ internet); questo
// script è la via che funziona SEMPRE: metti delle foto in una cartella, lui le
// abbina ai piatti e le pubblica.
//
// Abbinamento: dal NOME DEL FILE al nome del piatto (senza estensione, accenti e
// maiuscole ignorati). Es. `margherita.jpg` → piatto "Margherita";
// `tagliata-di-manzo.jpg` → "Tagliata di manzo". Chi non trova un piatto viene
// elencato a fine esecuzione, così correggi il nome del file e rilanci.
//
// Uso:
//   node scripts/demo-foto.mjs ~/Desktop/foto-piatti
//   (opzionale) DATABASE_URL=... per puntare a un DB diverso da quello dell'app
import { readdirSync, copyFileSync, mkdirSync, existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, dirname, extname, basename } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const require = createRequire(join(dirname(fileURLToPath(import.meta.url)), '..', 'apps', 'server', 'package.json'))
const postgres = require('postgres')

const SORGENTE = process.argv[2]
if (!SORGENTE) {
  console.error('Uso: node scripts/demo-foto.mjs <cartella-con-le-foto>')
  process.exit(1)
}
// Dove l'app pacchettizzata tiene gli upload (vedi src-tauri/src/lib.rs → UPLOADS_DIR)
const UPLOADS = process.env.UPLOADS_DIR ?? join(homedir(), 'Library', 'Application Support', 'com.tako.dashboard', 'uploads')

const norm = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim()

const sql = postgres(process.env.DATABASE_URL ?? 'postgresql://tako:tako@127.0.0.1:54317/takodb')
const piatti = await sql`select id, name, restaurant_id from menu_items`
const perNome = new Map(piatti.map(p => [norm(p.name), p]))

const file = readdirSync(SORGENTE).filter(f => /\.(jpe?g|png|webp)$/i.test(f))
const agganciate = [], orfane = []

for (const f of file) {
  const chiave = norm(basename(f, extname(f)))
  // esatto, poi "il nome del piatto inizia con…" (per `margherita-1.jpg`)
  const p = perNome.get(chiave) ?? piatti.find(x => norm(x.name).startsWith(chiave) || chiave.startsWith(norm(x.name)))
  if (!p) { orfane.push(f); continue }

  const dir = join(UPLOADS, p.restaurant_id)
  mkdirSync(dir, { recursive: true })
  const nomeFile = `demo-${norm(p.name).replace(/ /g, '-')}${extname(f).toLowerCase()}`
  copyFileSync(join(SORGENTE, f), join(dir, nomeFile))
  await sql`update menu_items set image_url = ${`/uploads/${p.restaurant_id}/${nomeFile}`}, updated_at = now() where id = ${p.id}`
  agganciate.push(`${f} → ${p.name}`)
}

const [conFoto] = await sql`select count(*)::int n from menu_items where image_url is not null and image_url <> ''`
console.log('--- FOTO DEMO ---')
console.log('cartella upload :', UPLOADS)
console.log('agganciate      :', agganciate.length)
agganciate.forEach(x => console.log('  ✓', x))
if (orfane.length) {
  console.log('senza abbinamento (rinomina il file col nome del piatto):')
  orfane.forEach(x => console.log('  ✗', x))
}
console.log('piatti con foto :', conFoto.n, 'su', piatti.length)
if (!existsSync(UPLOADS)) console.log('⚠️  la cartella upload non esisteva: l\'app deve essere stata avviata almeno una volta')

await sql.end()
