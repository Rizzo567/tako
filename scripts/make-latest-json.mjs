#!/usr/bin/env node
// Costruisce il latest.json dell'updater Tauri a partire dagli artifact di build
// raccolti in una cartella piatta. Ogni piattaforma ha un pacchetto updater
// (.app.tar.gz su macOS, .nsis.zip su Windows) + il suo file .sig (firma minisign).
//
// Uso:  node scripts/make-latest-json.mjs <distDir> <version> <baseUrl> [notes]
//   distDir  cartella con tutti gli artifact scaricati dai job matrix
//   version  es. 0.2.0 (senza la "v" del tag)
//   baseUrl  es. https://updates.takoitalia.com   (gli URL saranno baseUrl/<file>)
//
// Output: <distDir>/latest.json — poi caricato su Cloudflare accanto agli artifact.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const [distDir, version, baseUrl, notes = `Tako ${process.argv[3]}`] = process.argv.slice(2)
if (!distDir || !version || !baseUrl) {
  console.error('uso: make-latest-json.mjs <distDir> <version> <baseUrl> [notes]')
  process.exit(1)
}

// Mappa un nome file di pacchetto updater → chiave piattaforma Tauri.
function platformFor(file) {
  const f = file.toLowerCase()
  if (f.endsWith('.app.tar.gz')) {
    if (f.includes('aarch64') || f.includes('arm64')) return 'darwin-aarch64'
    if (f.includes('x64') || f.includes('x86_64') || f.includes('intel')) return 'darwin-x86_64'
    return 'darwin-aarch64' // default Apple Silicon
  }
  if (f.endsWith('.nsis.zip') || f.endsWith('.msi.zip')) return 'windows-x86_64'
  if (f.endsWith('.appimage.tar.gz')) return 'linux-x86_64'
  return null
}

const files = readdirSync(distDir)
const platforms = {}
for (const file of files) {
  const plat = platformFor(file)
  if (!plat) continue
  const sigFile = `${file}.sig`
  if (!files.includes(sigFile)) {
    console.warn(`⚠ manca la firma ${sigFile} per ${file} — salto`)
    continue
  }
  platforms[plat] = {
    signature: readFileSync(join(distDir, sigFile), 'utf8').trim(),
    url: `${baseUrl.replace(/\/$/, '')}/${encodeURIComponent(file)}`,
  }
  console.log(`✓ ${plat} → ${file}`)
}

if (Object.keys(platforms).length === 0) {
  console.error('✗ nessun artifact updater trovato in', distDir)
  process.exit(1)
}

const manifest = {
  version,
  notes,
  pub_date: process.env.PUB_DATE || new Date().toISOString(),
  platforms,
}
writeFileSync(join(distDir, 'latest.json'), JSON.stringify(manifest, null, 2))
console.log('✓ latest.json scritto con', Object.keys(platforms).length, 'piattaforme')
