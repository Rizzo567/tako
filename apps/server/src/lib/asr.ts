// ─────────────────────────────────────────────────────────────────────────────
// ASR dual-mode per la DETTATURA VOCALE di Tako.
//
// Due backend, fallback automatico in entrambe le direzioni:
//   • LOCALE — whisper.cpp `whisper-server` (large-v3-turbo, motore di HearFlow
//     importato in Tako, asr-whisper.ts). Offline, GPU Apple/Metal, nessun dato
//     lascia la macchina.
//   • CLOUD  — Groq whisper-large-v3 (chiave da env o ~/.tako-app-data/groq-key,
//     caricata in bootstrap.ts). Veloce quando online.
//
// Ordine: TAKO_ASR_PREFER=local|cloud (default: local se installato, poi cloud).
// L'ingresso è PCM16 mono; costruiamo un WAV in memoria per entrambi i motori.
// Groq via pacchetto `openai` già presente (baseURL Groq, come routes/insights.ts).
// ─────────────────────────────────────────────────────────────────────────────
import OpenAI, { toFile } from 'openai'
import { whisperAvailable, transcribeWhisperWav, warmupWhisper } from './asr-whisper.js'

export type AsrEngine = 'whisper-local' | 'groq'

export interface TranscribeOptions {
  sampleRate?: number          // default 16000
  language?: string            // default 'it'
  prefer?: AsrEngine           // forza un motore per primo
}

export interface TranscribeResult {
  text: string
  engine: AsrEngine
  ms: number
}

// ── WAV encoding (PCM16 mono) ────────────────────────────────────────────────
export function pcm16ToWav(pcm: Buffer, sampleRate: number): Buffer {
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

// ── Groq (whisper-large-v3) ──────────────────────────────────────────────────
// Client cacheato ma legato alla chiave: se GROQ_API_KEY cambia a runtime
// (es. l'utente la configura dopo l'avvio) il client si rigenera.
let groqClient: OpenAI | null = null
let groqClientKey = ''
function getGroq(): OpenAI {
  const key = process.env['GROQ_API_KEY']
  if (!key) throw new Error('GROQ_API_KEY non configurata')
  if (!groqClient || groqClientKey !== key) {
    groqClient = new OpenAI({ apiKey: key, baseURL: 'https://api.groq.com/openai/v1' })
    groqClientKey = key
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
export function getAsrStatus(): { local: boolean; cloud: boolean; engine: AsrEngine | 'none' } {
  const local = whisperAvailable()
  const cloud = !!process.env['GROQ_API_KEY']
  const preferred = engineOrder()[0]
  const engine: AsrEngine | 'none' =
    preferred === 'whisper-local' && local ? 'whisper-local'
    : cloud ? 'groq'
    : local ? 'whisper-local'
    : 'none'
  return { local, cloud, engine }
}

function engineOrder(prefer?: AsrEngine): AsrEngine[] {
  const pref = prefer
    ?? (process.env['TAKO_ASR_PREFER'] === 'cloud' ? 'groq'
      : process.env['TAKO_ASR_PREFER'] === 'local' ? 'whisper-local'
      : undefined)
  if (pref === 'groq') return ['groq', 'whisper-local']
  if (pref === 'whisper-local') return ['whisper-local', 'groq']
  // default: local-first se installato (privacy/offline), altrimenti cloud-first
  return whisperAvailable() ? ['whisper-local', 'groq'] : ['groq', 'whisper-local']
}

/** Pre-avvia il motore locale in background (chiamare all'avvio del server). */
export function warmupAsr(): void {
  warmupWhisper()
}

/**
 * Trascrive PCM16 mono. Tenta i motori in ordine (local-first di default),
 * fallback automatico sull'altro. Errore chiaro se nessuno disponibile.
 */
export async function transcribePcm16(
  pcm: Buffer, opts: TranscribeOptions = {},
): Promise<TranscribeResult> {
  const sampleRate = opts.sampleRate ?? 16000
  const language = opts.language ?? 'it'
  const wav = pcm16ToWav(pcm, sampleRate)
  const started = Date.now()

  const local = whisperAvailable()
  const cloud = !!process.env['GROQ_API_KEY']
  if (!local && !cloud) {
    throw new Error(
      'Nessun motore ASR disponibile: whisper-server locale non installato ' +
      '(binario asr/whisper + modello in ~/.tako/models) e GROQ_API_KEY non configurata.',
    )
  }

  const errors: string[] = []
  for (const engine of engineOrder(opts.prefer)) {
    try {
      if (engine === 'whisper-local') {
        if (!local) continue
        const text = await transcribeWhisperWav(wav, language)
        return { text, engine, ms: Date.now() - started }
      } else {
        if (!cloud) continue
        const text = await transcribeGroq(wav, language)
        return { text, engine, ms: Date.now() - started }
      }
    } catch (e) {
      errors.push(`${engine}: ${(e as Error).message}`)
    }
  }
  throw new Error(`Trascrizione fallita. ${errors.join(' | ')}`)
}
