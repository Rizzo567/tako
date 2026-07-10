import type { FastifyInstance } from 'fastify'
import { createWriteStream, mkdirSync, readdirSync, statSync } from 'fs'
import { join } from 'path'
import { nanoid } from 'nanoid'
import sharp from 'sharp'
import { requireAuth } from '../middleware/auth.js'

const UPLOADS_DIR = process.env['UPLOADS_DIR'] ?? './uploads'
mkdirSync(UPLOADS_DIR, { recursive: true })

// Quota PER-RISTORANTE sulla sua sotto-cartella uploads: senza scoping un tenant
// poteva esaurire un tetto globale e negare gli upload a TUTTI (cross-tenant DoS).
// Senza un tetto, ogni upload (fino a 10MB) resta su disco per sempre (anche gli
// orfani da imageUrl sostituiti). 2GB di default per ristorante, override via UPLOADS_MAX_BYTES.
const MAX_UPLOADS_BYTES = Number(process.env['UPLOADS_MAX_BYTES'] ?? 2 * 1024 * 1024 * 1024)

// Byte usati per ristorante (in-memory): seminati LAZY alla prima richiesta del
// tenant scansionando SOLO la sua sotto-cartella (piccola), poi aggiornati in modo
// incrementale → niente readdirSync O(N) sull'event loop ad ogni richiesta.
const tenantUsedBytes = new Map<string, number>()
// Byte "in volo" per ristorante: riserva sincrona che chiude la finestra TOCTOU
// tra check e write (N richieste parallele non possono più sforare il tetto).
const tenantInFlightBytes = new Map<string, number>()

function seedTenantUsage(tenantDir: string): number {
  try {
    return readdirSync(tenantDir).reduce((n, f) => {
      try { return n + statSync(join(tenantDir, f)).size } catch { return n }
    }, 0)
  } catch { return 0 }
}
// Limite di decodifica pixel: rifiuta decompression bomb prima di decodificare tutto.
const MAX_INPUT_PIXELS = 24_000_000
// Lato lungo massimo dopo re-encode: le immagini di menu non hanno bisogno di più.
const MAX_DIMENSION = 2000

const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
}

// Riconosce il tipo immagine dai magic bytes reali (non dall'header mimetype del
// client, falsificabile). Ritorna il MIME rilevato o null.
function sniffImageMime(buf: Buffer): string | null {
  if (buf.length < 12) return null
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg'
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'image/png'
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38) return 'image/gif'
  if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return 'image/webp'
  return null
}

export async function uploadRoutes(fastify: FastifyInstance) {
  fastify.post('/image', { preHandler: requireAuth }, async (req, reply) => {
    const data = await req.file()
    if (!data) return reply.code(400).send({ error: { code: 'NO_FILE', message: 'No file provided' } })

    if (!ALLOWED_MIME_TYPES.has(data.mimetype)) {
      return reply.code(400).send({ error: { code: 'INVALID_FILE_TYPE', message: 'Only JPEG, PNG, WebP and GIF images are allowed' } })
    }

    // Bufferizza (max 10MB già limitato in multipart) e verifica i magic bytes:
    // il tipo reale del contenuto deve combaciare con un'immagine ammessa.
    const buf = await data.toBuffer()
    const realMime = sniffImageMime(buf)
    if (!realMime || !ALLOWED_MIME_TYPES.has(realMime)) {
      return reply.code(400).send({ error: { code: 'INVALID_FILE_CONTENT', message: 'Il contenuto del file non è un\'immagine valida.' } })
    }

    // Ri-codifica con sharp: impone limitInputPixels (rifiuta decompression bomb),
    // strippa i metadati e ridimensiona entro MAX_DIMENSION. Così la dimensione finale
    // su disco e in pixel non è più controllata dall'attaccante. Errori → 400 (file malformato).
    let out: Buffer
    try {
      const isGif = realMime === 'image/gif'
      const pipeline = sharp(buf, { limitInputPixels: MAX_INPUT_PIXELS, animated: isGif })
      const meta = await pipeline.metadata()
      if ((meta.width ?? 0) * (meta.height ?? 0) > MAX_INPUT_PIXELS) {
        return reply.code(400).send({ error: { code: 'INVALID_FILE_CONTENT', message: 'Immagine troppo grande (dimensioni in pixel eccessive).' } })
      }
      const fmt = isGif ? 'gif' : realMime === 'image/png' ? 'png' : realMime === 'image/webp' ? 'webp' : 'jpeg'
      out = await pipeline
        .rotate()
        .resize({ width: MAX_DIMENSION, height: MAX_DIMENSION, fit: 'inside', withoutEnlargement: true })
        .toFormat(fmt)
        .toBuffer()
    } catch {
      return reply.code(400).send({ error: { code: 'INVALID_FILE_CONTENT', message: 'Il contenuto del file non è un\'immagine valida.' } })
    }

    // Storage e quota SCOPED per ristorante (restaurantId dal session token, non
    // falsificabile dal client). Check + riserva sono atomici: tra qui e l'increment
    // di inFlight non c'è alcun await, quindi su singolo thread Node le richieste
    // concorrenti vengono serializzate e nessuna sfora il tetto (no TOCTOU).
    const restId = req.user!.restaurantId
    const tenantDir = join(UPLOADS_DIR, restId)
    mkdirSync(tenantDir, { recursive: true })
    if (!tenantUsedBytes.has(restId)) tenantUsedBytes.set(restId, seedTenantUsage(tenantDir))
    const used = tenantUsedBytes.get(restId) ?? 0
    const inFlight = tenantInFlightBytes.get(restId) ?? 0
    if (used + inFlight + out.length > MAX_UPLOADS_BYTES) {
      return reply.code(507).send({ error: { code: 'STORAGE_FULL', message: 'Spazio immagini esaurito' } })
    }
    tenantInFlightBytes.set(restId, inFlight + out.length)

    // Usa l'estensione dal tipo REALE, non da quello dichiarato dal client.
    const ext = MIME_TO_EXT[realMime]!
    const filename = `${nanoid(16)}.${ext}`
    const filepath = join(tenantDir, filename)

    try {
      await new Promise<void>((resolve, reject) => {
        const ws = createWriteStream(filepath)
        ws.on('finish', resolve)
        ws.on('error', reject)
        ws.end(out)
      })
      // Commit incrementale (rilegge il valore corrente per non clobberare update concorrenti).
      tenantUsedBytes.set(restId, (tenantUsedBytes.get(restId) ?? 0) + out.length)
    } finally {
      // Rilascia la riserva: il file è ora contabilizzato in tenantUsedBytes (in caso
      // di errore non è stato scritto, quindi va comunque rilasciata).
      tenantInFlightBytes.set(restId, (tenantInFlightBytes.get(restId) ?? out.length) - out.length)
    }

    const url = `/uploads/${restId}/${filename}`
    return { data: { url } }
  })
}
