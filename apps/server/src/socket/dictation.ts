// ─────────────────────────────────────────────────────────────────────────────
// Gateway WebSocket per la DETTATURA VOCALE (namespace socket.io `/dictation`).
//
// MVP push-to-talk BATCH: il client registra mentre l'utente detta (Cmd+K),
// al termine invia UN segmento PCM16 mono; il server lo trascrive (ASR
// dual-mode: mlx locale → Groq cloud) e ripulisce il testo (Ollama → Groq →
// grezzo). Un solo round-trip: semplice e robusto. Streaming = fase 2.
//
// Autenticazione: stesso cookie HttpOnly staff (`tako_session`) del namespace
// principale. Un client non autenticato non può trascrivere (l'ASR costa).
//
// Protocollo:
//   client → 'finalize' { pcm: ArrayBuffer(int16 mono), sampleRate }
//   server → 'result'   { raw, text, asrEngine, cleanupEngine, asrMs, cleanupMs }
//   server → 'ready'    { local, cloud, engine }   (alla connessione, per la UI)
//   server → 'asr:error'{ message }
// ─────────────────────────────────────────────────────────────────────────────
import type { Server, Socket } from 'socket.io'
import { db, sessions, users } from '@tako/db'
import { eq, and, gt } from 'drizzle-orm'
import { SESSION_COOKIE } from '../lib/cookies.js'
import { transcribePcm16, getAsrStatus } from '../lib/asr.js'
import { cleanupText } from '../lib/cleanup.js'

// Un segmento di dettatura ragionevole è < ~60s. 16k * 2 byte * 60s ≈ 1.9 MB.
const MAX_SEGMENT_BYTES = 4 * 1024 * 1024      // ~128s @16k mono
const MAX_SAMPLE_RATE = 48000

async function verifyStaffToken(token: string): Promise<{ restaurantId: string } | null> {
  const [session] = await db
    .select({ restaurantId: users.restaurantId })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(and(eq(sessions.token, token), gt(sessions.expiresAt, new Date()), eq(users.active, true)))
    .limit(1)
  if (!session?.restaurantId) return null
  return { restaurantId: session.restaurantId }
}

function cookieFromHandshake(socket: Socket, name: string): string | null {
  const raw = socket.handshake.headers.cookie
  if (!raw) return null
  for (const part of raw.split(';')) {
    const i = part.indexOf('=')
    if (i === -1) continue
    if (part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim())
  }
  return null
}

interface FinalizeMsg {
  pcm: ArrayBuffer | Buffer | Uint8Array
  sampleRate?: number
}

export function setupDictationNamespace(io: Server): void {
  const nsp = io.of('/dictation')

  nsp.on('connection', (socket: Socket) => {
    void (async () => {
      const token = cookieFromHandshake(socket, SESSION_COOKIE)
      const staff = token ? await verifyStaffToken(token) : null
      if (!staff) {
        socket.emit('asr:error', { message: 'Sessione staff non valida. Effettua di nuovo il login.' })
        socket.disconnect(true)
        return
      }
      socket.data.restaurantId = staff.restaurantId

      const status = getAsrStatus()
      console.log(`[dettatura] connesso (rist ${staff.restaurantId.slice(0, 8)}…) — engine: ${status.engine}, local: ${status.local}, cloud: ${status.cloud}`)
      socket.emit('ready', status)
      if (status.engine === 'none') {
        socket.emit('asr:error', {
          message: 'Nessun motore vocale disponibile: installa il motore locale (setup-local-asr) o configura la chiave Groq.',
        })
      }

      // Errori del client (WKWebView) loggati qui: visibili da terminale senza
      // devtools nella webview.
      socket.on('clientlog', (m: { where?: string; name?: string; message?: string }) => {
        console.warn(`[dettatura][client] ${m?.where ?? '?'}: ${m?.name ?? ''} ${m?.message ?? ''}`)
      })

      // Una sola trascrizione in volo per socket: il push-to-talk è seriale.
      let inFlight = false

      socket.on('finalize', async (msg: FinalizeMsg) => {
        try {
          if (!msg || msg.pcm == null) return
          if (inFlight) {
            socket.emit('asr:error', { message: 'Trascrizione già in corso.' })
            return
          }
          const buf = toBuffer(msg.pcm)
          if (!buf || buf.length === 0) {
            socket.emit('asr:error', { message: 'Nessun audio registrato.' })
            return
          }
          if (buf.length > MAX_SEGMENT_BYTES) {
            socket.emit('asr:error', { message: 'Registrazione troppo lunga.' })
            return
          }
          inFlight = true
          try {
            const asr = await transcribePcm16(buf, {
              sampleRate: clampRate(msg.sampleRate),
              language: 'it',
            })
            if (!asr.text.trim()) {
              socket.emit('result', { raw: '', text: '', asrEngine: asr.engine, cleanupEngine: 'none', asrMs: asr.ms, cleanupMs: 0 })
              return
            }
            const clean = await cleanupText(asr.text)
            console.log(`[dettatura] ok — asr=${asr.engine}(${asr.ms}ms) cleanup=${clean.engine}(${clean.ms}ms) "${clean.text.slice(0, 60)}"`)
            socket.emit('result', {
              raw: asr.text,
              text: clean.text,
              asrEngine: asr.engine,
              cleanupEngine: clean.engine,
              asrMs: asr.ms,
              cleanupMs: clean.ms,
            })
          } finally {
            inFlight = false
          }
        } catch (e) {
          inFlight = false
          console.warn(`[dettatura] errore: ${(e as Error).message}`)
          socket.emit('asr:error', { message: (e as Error).message })
        }
      })
    })()
  })
}

function toBuffer(pcm: ArrayBuffer | Buffer | Uint8Array): Buffer | null {
  if (Buffer.isBuffer(pcm)) return pcm
  if (pcm instanceof Uint8Array) return Buffer.from(pcm.buffer, pcm.byteOffset, pcm.byteLength)
  if (pcm instanceof ArrayBuffer) return Buffer.from(pcm)
  return null
}

function clampRate(r?: number): number {
  if (typeof r !== 'number' || !isFinite(r) || r <= 0) return 16000
  return Math.min(MAX_SAMPLE_RATE, Math.max(8000, Math.round(r)))
}
