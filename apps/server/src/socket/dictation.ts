// ─────────────────────────────────────────────────────────────────────────────
// Gateway WebSocket per la DETTATURA VOCALE (namespace socket.io `/dictation`).
//
// Il browser fa cattura mic + VAD + denoise e invia SEGMENTI di audio PCM16 mono.
// Il server li trascrive (whisper.cpp locale → Groq fallback) e restituisce testo
// parziale (mentre parli) e finale (a fine segmento). Il client accumula i finali
// nel campo chat.
//
// Autenticazione: stesso cookie HttpOnly staff (`tako_session`) usato dal namespace
// principale. Un client non autenticato non può trascrivere (l'ASR costa risorse/API).
//
// Protocollo:
//   client → 'seg'  { pcm: ArrayBuffer(int16 mono), sampleRate, seq, final }
//   server → 'text' { text, seq, final, engine }
//   server → 'ready'{ local, cloud, engine }   (all'attivazione, per la UI)
//   server → 'asr:error' { message }            (nessun motore / trascrizione fallita)
// ─────────────────────────────────────────────────────────────────────────────
import type { Server, Socket } from 'socket.io'
import { db, sessions, users } from '@tako/db'
import { eq, and, gt } from 'drizzle-orm'
import { SESSION_COOKIE } from '../lib/cookies.js'
import { transcribePcm16, getAsrStatus, type AsrEngine } from '../lib/asr.js'

// Limiti di sicurezza: un segmento di dettatura ragionevole è < ~30s.
// 16000 campioni/s * 2 byte * 30s ≈ 960 KB. Teniamo un tetto generoso ma finito.
const MAX_SEGMENT_BYTES = 2 * 1024 * 1024      // ~64s @16k mono
const MAX_SAMPLE_RATE = 48000

async function verifyStaffToken(token: string): Promise<{ restaurantId: string } | null> {
  const [session] = await db
    .select({ restaurantId: users.restaurantId })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(and(eq(sessions.token, token), gt(sessions.expiresAt, new Date())))
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

interface SegmentMsg {
  pcm: ArrayBuffer | Buffer | Uint8Array
  sampleRate?: number
  seq?: number
  final?: boolean
}

export function setupDictationNamespace(io: Server): void {
  const nsp = io.of('/dictation')

  nsp.on('connection', (socket: Socket) => {
    // Auth all'aggancio: senza cookie staff valido, chiudiamo.
    void (async () => {
      const token = cookieFromHandshake(socket, SESSION_COOKIE)
      const staff = token ? await verifyStaffToken(token) : null
      if (!staff) {
        socket.emit('asr:error', { message: 'Sessione staff non valida. Effettua di nuovo il login.' })
        socket.disconnect(true)
        return
      }
      socket.data.restaurantId = staff.restaurantId

      const status = await getAsrStatus()
      socket.emit('ready', status)
      if (status.engine === 'none') {
        socket.emit('asr:error', {
          message: 'Nessun motore vocale disponibile: installa whisper.cpp o configura la chiave Groq.',
        })
      }

      // Un solo transcode "parziale" in volo per socket: se ne arriva un altro mentre
      // uno è in corso, lo scartiamo (il segmento successivo sarà più completo).
      // I FINALI hanno priorità e non vengono mai scartati.
      let partialInFlight = false

      socket.on('seg', async (msg: SegmentMsg) => {
        try {
          if (!msg || msg.pcm == null) return
          const buf = toBuffer(msg.pcm)
          if (!buf || buf.length === 0) return
          if (buf.length > MAX_SEGMENT_BYTES) {
            socket.emit('asr:error', { message: 'Segmento audio troppo lungo.' })
            return
          }
          const sampleRate = clampRate(msg.sampleRate)
          const seq = typeof msg.seq === 'number' ? msg.seq : 0
          const final = !!msg.final

          if (!final) {
            if (partialInFlight) return          // backpressure: droppa parziale stale
            partialInFlight = true
          }

          let engine: AsrEngine | undefined
          try {
            const r = await transcribePcm16(buf, {
              sampleRate,
              language: 'it',
              partial: !final,
              // I parziali brevi vanno più veloci sul cloud quando disponibile; il
              // FINALE resta local-first (default) per fedeltà e coerenza offline.
              prefer: !final && process.env['GROQ_API_KEY'] ? 'groq' : undefined,
            })
            engine = r.engine
            socket.emit('text', { text: r.text, seq, final, engine: r.engine })
          } finally {
            if (!final) partialInFlight = false
          }
        } catch (e) {
          if (!msg?.final) partialInFlight = false
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
