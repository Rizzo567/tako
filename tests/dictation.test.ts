import { describe, it, expect, afterEach, vi } from 'vitest'
import { pcm16ToWav, getAsrStatus, transcribePcm16 } from '../apps/server/src/lib/asr.js'
import { localAsrAvailable } from '../apps/server/src/lib/asr-local.js'
import { cleanupText } from '../apps/server/src/lib/cleanup.js'

// Unit test PURI della pipeline dettatura (nessun server/DB richiesto):
// encoding WAV, disponibilità/ordine dei motori ASR, fallback del cleanup.
// I percorsi live (mlx worker reale, Groq reale, socket) sono coperti dallo
// smoke E2E (scripts/test-dictation-e2e.mjs) e dal test in-app.

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('pcm16ToWav', () => {
  it('produce un header WAV canonico (PCM16 mono)', () => {
    const pcm = Buffer.alloc(3200) // 100ms @16k
    const wav = pcm16ToWav(pcm, 16000)
    expect(wav.length).toBe(44 + 3200)
    expect(wav.toString('ascii', 0, 4)).toBe('RIFF')
    expect(wav.toString('ascii', 8, 12)).toBe('WAVE')
    expect(wav.readUInt16LE(20)).toBe(1)          // PCM
    expect(wav.readUInt16LE(22)).toBe(1)          // mono
    expect(wav.readUInt32LE(24)).toBe(16000)      // sample rate
    expect(wav.readUInt16LE(34)).toBe(16)         // bit depth
    expect(wav.readUInt32LE(40)).toBe(3200)       // data size
  })
})

describe('disponibilità motori ASR', () => {
  it('locale non disponibile se il python del venv non esiste', () => {
    vi.stubEnv('TAKO_ASR_PYTHON', '/nonexistent/python')
    expect(localAsrAvailable()).toBe(false)
  })

  it('engine none senza locale né cloud', () => {
    vi.stubEnv('TAKO_ASR_PYTHON', '/nonexistent/python')
    vi.stubEnv('GROQ_API_KEY', '')
    const s = getAsrStatus()
    expect(s.local).toBe(false)
    expect(s.cloud).toBe(false)
    expect(s.engine).toBe('none')
  })

  it('cloud-first quando il locale manca e la chiave Groq c\'è', () => {
    vi.stubEnv('TAKO_ASR_PYTHON', '/nonexistent/python')
    vi.stubEnv('GROQ_API_KEY', 'gsk_test')
    const s = getAsrStatus()
    expect(s.local).toBe(false)
    expect(s.cloud).toBe(true)
    expect(s.engine).toBe('groq')
  })

  it('transcribePcm16 rifiuta con messaggio chiaro se nessun motore', async () => {
    vi.stubEnv('TAKO_ASR_PYTHON', '/nonexistent/python')
    vi.stubEnv('GROQ_API_KEY', '')
    await expect(transcribePcm16(Buffer.alloc(320))).rejects.toThrow(/Nessun motore ASR/)
  })
})

describe('cleanupText (fallback: Ollama → Groq → grezzo)', () => {
  it('testo brevissimo: nessun cleanup, engine none', async () => {
    const r = await cleanupText('ok')
    expect(r.text).toBe('ok')
    expect(r.engine).toBe('none')
  })

  it('Ollama attivo: ripulisce e sceglie il modello preferito', async () => {
    const calls: string[] = []
    vi.stubGlobal('fetch', vi.fn(async (url: any, init?: any) => {
      const u = String(url)
      calls.push(u)
      if (u.endsWith('/api/tags')) {
        return new Response(JSON.stringify({ models: [{ name: 'gemma4:26b' }, { name: 'qwen2.5:7b' }] }))
      }
      if (u.endsWith('/api/chat')) {
        const body = JSON.parse(init.body)
        expect(body.model).toBe('qwen2.5:7b')              // preferito su gemma4
        expect(body.options.temperature).toBe(0.1)
        return new Response(JSON.stringify({ message: { content: '"Ciao, come stai?"' } }))
      }
      throw new Error('URL inatteso: ' + u)
    }))
    const r = await cleanupText('ehm ciao come stai')
    expect(r.text).toBe('Ciao, come stai?')                // sanitize toglie le virgolette
    expect(r.engine).toBe('ollama')
    expect(calls.some((c) => c.endsWith('/api/chat'))).toBe(true)
  })

  it('Ollama giù e niente Groq: torna il grezzo, mai un throw', async () => {
    vi.stubEnv('GROQ_API_KEY', '')
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('ECONNREFUSED') }))
    const raw = 'allora volevo dire che il tavolo tre ha ordinato'
    const r = await cleanupText(raw)
    expect(r.text).toBe(raw)
    expect(r.engine).toBe('none')
  })

  it('risposta vuota dal modello: fallback al grezzo', async () => {
    vi.stubEnv('GROQ_API_KEY', '')
    vi.stubGlobal('fetch', vi.fn(async (url: any) => {
      const u = String(url)
      if (u.endsWith('/api/tags')) return new Response(JSON.stringify({ models: [{ name: 'qwen2.5:7b' }] }))
      return new Response(JSON.stringify({ message: { content: '   ' } }))
    }))
    const raw = 'testo di prova sufficientemente lungo'
    const r = await cleanupText(raw)
    expect(r.text).toBe(raw)
    expect(r.engine).toBe('none')
  })
})
