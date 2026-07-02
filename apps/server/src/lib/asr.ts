// ─────────────────────────────────────────────────────────────────────────────
// ASR engine per la DETTATURA VOCALE di Tako.
//
// Strategia (decisa da Manuel): **locale primario + fallback cloud**.
//   1. whisper.cpp sul Mac (Metal) — default, coerente col local-first.
//   2. Groq whisper-large-v3 — fallback cloud, quando online e per audio difficile,
//      o quando whisper.cpp non è installato.
//   3. Se offline e whisper.cpp assente → errore chiaro e attuabile.
//
// L'ingresso è sempre PCM 16-bit little-endian, mono. Costruiamo un WAV in memoria
// e lo diamo al motore scelto. Nessuna dipendenza nuova: whisper.cpp via child_process,
// Groq via il pacchetto `openai` già presente (baseURL Groq, come in routes/insights.ts).
// ─────────────────────────────────────────────────────────────────────────────
import { spawn } from 'node:child_process'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { existsSync } from 'node:fs'
import { writeFile, readFile, unlink, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir, homedir, cpus } from 'node:os'
import { randomBytes } from 'node:crypto'
import OpenAI, { toFile } from 'openai'

const execFileP = promisify(execFile)

export type AsrEngine = 'whisper-cpp' | 'groq'

export interface TranscribeOptions {
  sampleRate?: number          // default 16000
  language?: string            // default 'it'
  /** Forza un motore specifico (per debug / partial veloci su cloud). */
  prefer?: AsrEngine
  /** true = richiesta "parziale" (in corso). Alziamo un pelo la tolleranza. */
  partial?: boolean
}

export interface TranscribeResult {
  text: string
  engine: AsrEngine
  ms: number
}

// ── WAV encoding (PCM16 mono) ────────────────────────────────────────────────
// Header canonico 44 byte + dati. whisper.cpp e Groq accettano entrambi WAV PCM.
function pcm16ToWav(pcm: Buffer, sampleRate: number): Buffer {
  const numChannels = 1
  const byteRate = sampleRate * numChannels * 2
  const blockAlign = numChannels * 2
  const header = Buffer.alloc(44)
  header.write('RIFF', 0)
  header.writeUInt32LE(36 + pcm.length, 4)
  header.write('WAVE', 8)
  header.write('fmt ', 12)
  header.writeUInt32LE(16, 16)       // PCM chunk size
  header.writeUInt16LE(1, 20)        // audio format = PCM
  header.writeUInt16LE(numChannels, 22)
  header.writeUInt32LE(sampleRate, 24)
  header.writeUInt32LE(byteRate, 28)
  header.writeUInt16LE(blockAlign, 32)
  header.writeUInt16LE(16, 34)       // bits per sample
  header.write('data', 36)
  header.writeUInt32LE(pcm.length, 40)
  return Buffer.concat([header, pcm])
}

// ── Rilevamento whisper.cpp (cache) ──────────────────────────────────────────
// Cerchiamo binario + modello una sola volta e memorizziamo l'esito.
interface WhisperSetup { cli: string; model: string }
let whisperProbe: Promise<WhisperSetup | null> | null = null

async function which(bin: string): Promise<string | null> {
  try {
    const { stdout } = await execFileP('which', [bin])
    const p = stdout.trim()
    return p && existsSync(p) ? p : null
  } catch { return null }
}

async function findWhisperCli(): Promise<string | null> {
  const env = process.env['WHISPER_CLI']
  if (env && existsSync(env)) return env
  const home = homedir()
  const candidates = [
    join(home, 'whisper.cpp/build/bin/whisper-cli'),
    join(home, 'whisper.cpp/build/bin/main'),
    join(home, 'whisper.cpp/main'),
    '/opt/homebrew/bin/whisper-cli',
    '/usr/local/bin/whisper-cli',
    '/opt/homebrew/bin/whisper-cpp',
  ]
  for (const c of candidates) if (existsSync(c)) return c
  return (await which('whisper-cli')) ?? (await which('whisper-cpp')) ?? (await which('main'))
}

function findWhisperModel(): string | null {
  const env = process.env['WHISPER_MODEL']
  if (env && existsSync(env)) return env
  const home = homedir()
  const takoHome = process.env['TAKO_HOME'] ?? join(home, '.tako')
  // Preferenza: large-v3 → medium → small (degradazione qualità→velocità).
  const names = [
    'ggml-large-v3.bin', 'ggml-large-v3-turbo.bin',
    'ggml-medium.bin', 'ggml-medium-q5_0.bin',
    'ggml-small.bin',
  ]
  const dirs = [
    join(takoHome, 'models'),
    join(home, 'whisper.cpp/models'),
    '/opt/homebrew/share/whisper-cpp',
  ]
  for (const d of dirs) for (const n of names) {
    const p = join(d, n)
    if (existsSync(p)) return p
  }
  return null
}

async function probeWhisper(): Promise<WhisperSetup | null> {
  if (!whisperProbe) {
    whisperProbe = (async () => {
      const cli = await findWhisperCli()
      if (!cli) return null
      const model = findWhisperModel()
      if (!model) return null
      return { cli, model }
    })()
  }
  return whisperProbe
}

// ── Trascrizione con whisper.cpp ─────────────────────────────────────────────
async function transcribeWhisperCpp(
  wav: Buffer, setup: WhisperSetup, language: string,
): Promise<string> {
  const base = join(tmpdir(), `tako-asr-${randomBytes(8).toString('hex')}`)
  const wavPath = `${base}.wav`
  const outBase = base                    // whisper-cli scrive <outBase>.txt
  await writeFile(wavPath, wav)
  try {
    // -nt no-timestamps, -np no-prints, -otxt output file, -l lingua, -t threads.
    // Metal è attivo di default nella build macOS di whisper.cpp.
    const args = [
      '-m', setup.model,
      '-f', wavPath,
      '-l', language,
      '-nt', '-np',
      '-otxt', '-of', outBase,
      '-t', String(Math.max(4, cpus().length)),
    ]
    await new Promise<void>((resolvePromise, reject) => {
      const proc = spawn(setup.cli, args, { stdio: ['ignore', 'ignore', 'pipe'] })
      let err = ''
      proc.stderr.on('data', (d) => { err += d.toString() })
      proc.on('error', reject)
      proc.on('close', (code) => code === 0 ? resolvePromise() : reject(new Error(`whisper-cli exit ${code}: ${err.slice(-400)}`)))
    })
    const txt = await readFile(`${outBase}.txt`, 'utf8').catch(() => '')
    return txt.trim()
  } finally {
    unlink(wavPath).catch(() => {})
    unlink(`${outBase}.txt`).catch(() => {})
  }
}

// ── Trascrizione con Groq (whisper-large-v3) ─────────────────────────────────
let groqClient: OpenAI | null = null
function getGroq(): OpenAI {
  if (!process.env['GROQ_API_KEY']) throw new Error('GROQ_API_KEY non configurata')
  if (!groqClient) {
    groqClient = new OpenAI({
      apiKey: process.env['GROQ_API_KEY'],
      baseURL: 'https://api.groq.com/openai/v1',
    })
  }
  return groqClient
}

async function transcribeGroq(wav: Buffer, language: string): Promise<string> {
  const client = getGroq()
  const file = await toFile(wav, 'audio.wav', { type: 'audio/wav' })
  const res = await client.audio.transcriptions.create({
    file,
    model: 'whisper-large-v3',
    language,
    temperature: 0,
    response_format: 'json',
  })
  return (res.text ?? '').trim()
}

// ── API pubblica ─────────────────────────────────────────────────────────────
export async function getAsrStatus(): Promise<{
  local: boolean; cloud: boolean; localModel: string | null; engine: AsrEngine | 'none'
}> {
  const w = await probeWhisper()
  const cloud = !!process.env['GROQ_API_KEY']
  const engine: AsrEngine | 'none' = w ? 'whisper-cpp' : cloud ? 'groq' : 'none'
  return { local: !!w, cloud, localModel: w?.model ?? null, engine }
}

/**
 * Trascrive un buffer PCM16 mono. Prova prima il locale (whisper.cpp), poi il
 * fallback Groq. Se `prefer` è impostato, tenta quel motore per primo.
 * Lancia con messaggio chiaro se nessun motore è disponibile.
 */
export async function transcribePcm16(
  pcm: Buffer, opts: TranscribeOptions = {},
): Promise<TranscribeResult> {
  const sampleRate = opts.sampleRate ?? 16000
  const language = opts.language ?? 'it'
  const wav = pcm16ToWav(pcm, sampleRate)
  const started = Date.now()

  const whisper = await probeWhisper()
  const hasCloud = !!process.env['GROQ_API_KEY']

  // Ordine dei tentativi. Default local-first; `prefer:'groq'` mette il cloud davanti
  // (utile per i parziali veloci quando online).
  const order: AsrEngine[] = opts.prefer === 'groq'
    ? ['groq', 'whisper-cpp']
    : ['whisper-cpp', 'groq']

  const errors: string[] = []
  for (const engine of order) {
    try {
      if (engine === 'whisper-cpp') {
        if (!whisper) continue
        const text = await transcribeWhisperCpp(wav, whisper, language)
        return { text, engine, ms: Date.now() - started }
      } else {
        if (!hasCloud) continue
        const text = await transcribeGroq(wav, language)
        return { text, engine, ms: Date.now() - started }
      }
    } catch (e) {
      errors.push(`${engine}: ${(e as Error).message}`)
    }
  }

  if (!whisper && !hasCloud) {
    throw new Error(
      'Nessun motore ASR disponibile: whisper.cpp non è installato e GROQ_API_KEY non è configurata. ' +
      'Installa whisper.cpp (vedi docs) oppure imposta GROQ_API_KEY per il fallback cloud.',
    )
  }
  throw new Error(`Trascrizione fallita. ${errors.join(' | ')}`)
}
