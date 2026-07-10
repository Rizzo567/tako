// ─────────────────────────────────────────────────────────────────────────────
// Smoke E2E della pipeline dettatura (senza socket/DB): ASR dual-mode + cleanup.
//
//   node --import tsx scripts/test-dictation-e2e.mjs <file.wav>
//   (lanciarlo da apps/server, o con cwd qualunque: i path sono risolti qui)
//
// Matrice testata:
//   A. ASR locale (mlx)            — engine atteso: mlx-local
//   B. ASR cloud (Groq)            — engine atteso: groq
//   C. fallback locale→cloud       — venv finto assente → groq
//   D. fallback cloud→locale       — chiave Groq invalida → mlx-local
//   E. cleanup Ollama              — engine atteso: ollama
//   F. cleanup con Ollama giù      — fallback: groq (o none se offline)
//
// La chiave Groq è letta come fa bootstrap.ts (env o file app-data).
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'

const wavPath = process.argv[2]
if (!wavPath || !existsSync(wavPath)) {
  console.error('uso: node --import tsx scripts/test-dictation-e2e.mjs <file.wav>')
  process.exit(1)
}

// Chiave Groq come in bootstrap.ts (env → file app-data → ~/.tako)
if (!process.env.GROQ_API_KEY) {
  for (const dir of [
    join(homedir(), 'Library', 'Application Support', 'com.tako.dashboard'),
    join(homedir(), '.tako'),
  ]) {
    const f = join(dir, 'groq-key')
    if (existsSync(f)) {
      const k = readFileSync(f, 'utf8').trim()
      if (k) { process.env.GROQ_API_KEY = k; break }
    }
  }
}

// WAV → PCM16 (trova il chunk 'data', non assumere header da 44 byte)
function wavToPcm(buf) {
  if (buf.toString('ascii', 0, 4) !== 'RIFF') throw new Error('non è un WAV')
  const sampleRate = buf.readUInt32LE(24)
  let off = 12
  while (off + 8 <= buf.length) {
    const id = buf.toString('ascii', off, off + 4)
    const size = buf.readUInt32LE(off + 4)
    if (id === 'data') return { pcm: buf.subarray(off + 8, off + 8 + size), sampleRate }
    off += 8 + size + (size % 2)
  }
  throw new Error('chunk data non trovato')
}

const { pcm, sampleRate } = wavToPcm(readFileSync(wavPath))
console.log(`audio: ${pcm.length} byte PCM @${sampleRate} Hz (${(pcm.length / 2 / sampleRate).toFixed(1)}s)`)

const results = []
async function scenario(name, envPatch, fn, expected) {
  const saved = {}
  for (const [k, v] of Object.entries(envPatch)) {
    saved[k] = process.env[k]
    if (v === null) delete process.env[k]
    else process.env[k] = v
  }
  try {
    const r = await fn()
    const ok = expected ? expected(r) : true
    results.push({ name, ok, detail: JSON.stringify(r).slice(0, 140) })
    console.log(`${ok ? '✓' : '✗'} ${name} → ${JSON.stringify(r).slice(0, 200)}`)
  } catch (e) {
    results.push({ name, ok: false, detail: e.message })
    console.log(`✗ ${name} → ERRORE: ${e.message}`)
  } finally {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k]
      else process.env[k] = v
    }
  }
}

// Import DOPO aver sistemato l'env di base (i moduli leggono env a runtime)
const { transcribePcm16 } = await import('../apps/server/src/lib/asr.ts')
const { cleanupText } = await import('../apps/server/src/lib/cleanup.ts')

const t0 = Date.now()

// A. locale
let rawText = ''
await scenario('A: ASR locale (mlx-local)', { TAKO_ASR_PREFER: 'local' }, async () => {
  const r = await transcribePcm16(pcm, { sampleRate, language: 'it' })
  rawText = r.text
  return { engine: r.engine, ms: r.ms, text: r.text.slice(0, 80) }
}, (r) => r.engine === 'mlx-local' && r.text.length > 10)

// B. cloud
await scenario('B: ASR cloud (groq)', { TAKO_ASR_PREFER: 'cloud' }, async () => {
  const r = await transcribePcm16(pcm, { sampleRate, language: 'it' })
  return { engine: r.engine, ms: r.ms, text: r.text.slice(0, 80) }
}, (r) => r.engine === 'groq' && r.text.length > 10)

// C. fallback locale→cloud (venv "assente")
await scenario('C: fallback locale→cloud', { TAKO_ASR_PREFER: 'local', TAKO_ASR_PYTHON: '/nonexistent/python' }, async () => {
  const r = await transcribePcm16(pcm, { sampleRate, language: 'it' })
  return { engine: r.engine, ms: r.ms }
}, (r) => r.engine === 'groq')

// D. fallback cloud→locale (chiave invalida)
await scenario('D: fallback cloud→locale', { TAKO_ASR_PREFER: 'cloud', GROQ_API_KEY: 'gsk_invalid_key_for_test' }, async () => {
  const r = await transcribePcm16(pcm, { sampleRate, language: 'it' })
  return { engine: r.engine, ms: r.ms }
}, (r) => r.engine === 'mlx-local')

// E. cleanup via Ollama (se attivo)
const fallbackRaw = 'ehm allora cioè volevo dire che il tavolo tre ha ordinato due margherite'
await scenario('E: cleanup Ollama', {}, async () => {
  const r = await cleanupText(rawText || fallbackRaw)
  return { engine: r.engine, ms: r.ms, text: r.text.slice(0, 100) }
}, (r) => r.engine === 'ollama' && r.text.length > 5)

// F. cleanup con Ollama giù → groq
await scenario('F: cleanup fallback → groq', { TAKO_OLLAMA_URL: 'http://127.0.0.1:9' }, async () => {
  const r = await cleanupText(rawText || fallbackRaw)
  return { engine: r.engine, ms: r.ms, text: r.text.slice(0, 100) }
}, (r) => r.engine === 'groq')

console.log(`\ntotale: ${((Date.now() - t0) / 1000).toFixed(1)}s`)
const failed = results.filter((r) => !r.ok)
console.log(failed.length === 0 ? `\n✓✓ TUTTI I ${results.length} SCENARI PASSANO` : `\n✗✗ ${failed.length} FALLITI: ${failed.map((f) => f.name).join(', ')}`)
process.exit(failed.length === 0 ? 0 : 1)
