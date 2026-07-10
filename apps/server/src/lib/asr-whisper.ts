// ─────────────────────────────────────────────────────────────────────────────
// Motore ASR LOCALE di Tako basato su whisper.cpp `whisper-server` (motore di
// HearFlow, importato dentro Tako). Sostituisce il vecchio worker mlx-whisper.
//
// whisper-server è un daemon HTTP: carica il modello UNA volta e trascrive via
// POST /inference (multipart WAV 16 kHz mono → JSON {text}). Tako lo spawna in
// locale su una porta dedicata (default 8766, per non collidere con l'app
// HearFlow che usa 8765) puntando al modello ggml importato.
//
// Percorsi (override via env):
//   binario  TAKO_WHISPER_BIN    → default: risorse Tako (asr/whisper/whisper-server)
//   modello  TAKO_WHISPER_MODEL  → default: ~/.tako/models/ggml-large-v3-turbo-q8_0.bin
//   porta    TAKO_WHISPER_PORT   → default: 8766
//
// Robustezza: se lo spawn fallisce l'esito negativo è cacheato 60s (il chiamante
// in asr.ts fa fallback su Groq). Se un whisper-server risponde già sulla porta
// (es. istanza esterna) lo si riusa senza spawnare.
// ─────────────────────────────────────────────────────────────────────────────
import { spawn, type ChildProcess } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { homedir } from 'node:os'
import { fileURLToPath } from 'node:url'

const HOST = '127.0.0.1'
const PORT = Number(process.env['TAKO_WHISPER_PORT'] ?? 8766)
const BASE = `http://${HOST}:${PORT}`
const READY_TIMEOUT_MS = 180_000   // primo avvio: caricamento modello (Metal)
const REQUEST_TIMEOUT_MS = 60_000
const SPAWN_FAIL_CACHE_MS = 60_000

function here(): string {
  return dirname(fileURLToPath(import.meta.url))
}

function binPath(): string | null {
  // Env esplicito = autoritativo: se impostato ma inesistente → non disponibile
  // (niente fallback ai default; utile anche per forzare OFF nei test).
  const env = process.env['TAKO_WHISPER_BIN']
  if (env !== undefined && env !== '') return existsSync(env) ? env : null
  const rel = ['asr', 'whisper', 'whisper-server']
  const cands = [
    // dev (src/lib) e packaged (dist/lib | resources/server): risali fino a apps/server
    join(here(), ...rel),
    join(here(), '..', ...rel),
    join(here(), '..', '..', ...rel),
    join(here(), '..', '..', '..', ...rel),
    // dev: il server gira con cwd = apps/server
    join(process.cwd(), ...rel),
  ]
  for (const c of cands) if (existsSync(c)) return c
  return null
}

function modelPath(): string | null {
  const env = process.env['TAKO_WHISPER_MODEL']
  if (env !== undefined && env !== '') return existsSync(env) ? env : null
  const cands = [
    join(homedir(), '.tako', 'models', 'ggml-large-v3-turbo-q8_0.bin'),
    join(homedir(), '.tako', 'models', 'ggml-large-v3-turbo-q5_0.bin'),
    // fallback nel bundle (se un giorno lo si impacchetta accanto al binario)
    join(here(), 'asr', 'whisper', 'ggml-large-v3-turbo-q8_0.bin'),
    join(process.cwd(), 'asr', 'whisper', 'ggml-large-v3-turbo-q8_0.bin'),
  ]
  for (const c of cands) if (existsSync(c)) return c
  return null
}

/** Il locale è utilizzabile? (binario + modello presenti — lo spawn resta lazy) */
export function whisperAvailable(): boolean {
  return binPath() !== null && modelPath() !== null
}

let proc: ChildProcess | null = null
let readyPromise: Promise<void> | null = null
let lastSpawnFailAt = 0

async function health(): Promise<boolean> {
  try {
    const ac = new AbortController()
    const to = setTimeout(() => ac.abort(), 1500)
    try {
      const r = await fetch(BASE + '/', { method: 'GET', signal: ac.signal })
      // whisper-server serve una pagina su '/' quando è pronto (200). Un 4xx va
      // comunque bene: significa che il processo risponde.
      return r.status < 500
    } finally { clearTimeout(to) }
  } catch { return false }
}

function ensureServer(): Promise<void> {
  if (readyPromise) return readyPromise
  const bin = binPath(), model = modelPath()
  if (!bin || !model) return Promise.reject(new Error('whisper-server o modello non trovati'))
  if (Date.now() - lastSpawnFailAt < SPAWN_FAIL_CACHE_MS) {
    return Promise.reject(new Error('whisper-server: spawn recentemente fallito'))
  }
  readyPromise = (async () => {
    if (await health()) return // già vivo (istanza nostra o esterna) → riuso
    proc = spawn(bin, ['-m', model, '--host', HOST, '--port', String(PORT), '-bs', '5', '-l', 'it'], { stdio: 'ignore' })
    proc.on('exit', () => { proc = null; readyPromise = null })
    proc.on('error', () => { proc = null; readyPromise = null })
    const deadline = Date.now() + READY_TIMEOUT_MS
    while (Date.now() < deadline) {
      if (await health()) return
      await new Promise((r) => setTimeout(r, 500))
    }
    lastSpawnFailAt = Date.now()
    readyPromise = null
    try { proc?.kill() } catch { /* noop */ }
    proc = null
    throw new Error('whisper-server non pronto entro il timeout')
  })()
  return readyPromise
}

/** Pre-avvia il server locale in background (chiamato all'avvio di Tako). */
export function warmupWhisper(): void {
  if (whisperAvailable()) ensureServer().catch(() => { /* fallback su cloud a runtime */ })
}

/** Trascrive un WAV (16 kHz mono, PCM16) col whisper-server locale. */
export async function transcribeWhisperWav(wav: Buffer, language: string): Promise<string> {
  await ensureServer()
  const ac = new AbortController()
  const to = setTimeout(() => ac.abort(), REQUEST_TIMEOUT_MS)
  try {
    const form = new FormData()
    form.append('file', new Blob([wav], { type: 'audio/wav' }), 'audio.wav')
    form.append('language', language || 'it')
    form.append('response_format', 'json')
    form.append('temperature', '0')
    const r = await fetch(BASE + '/inference', { method: 'POST', body: form, signal: ac.signal })
    if (!r.ok) throw new Error(`whisper-server HTTP ${r.status}`)
    const j: any = await r.json()
    return String(j?.text ?? '').trim()
  } finally { clearTimeout(to) }
}
