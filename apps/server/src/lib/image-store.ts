// ─────────────────────────── Tako — STORAGE IMMAGINI (riusabile) ───────────────────────────
// Salvataggio immagini piatti su disco (/uploads/<restaurantId>/), con validazione magic
// bytes + re-encode sharp (anti decompression-bomb, strip metadati, resize) + quota per
// ristorante. Estratto dalla route POST /api/uploads/image così che ANCHE il canale
// WhatsApp e il copilot in-app possano salvare un'immagine (stessa pipeline e stessi tetti).
import { createWriteStream, mkdirSync, readdirSync, statSync } from 'fs'
import { join } from 'path'
import { nanoid } from 'nanoid'
import sharp from 'sharp'

export const UPLOADS_DIR = process.env['UPLOADS_DIR'] ?? './uploads'
mkdirSync(UPLOADS_DIR, { recursive: true })

const MAX_UPLOADS_BYTES = Number(process.env['UPLOADS_MAX_BYTES'] ?? 2 * 1024 * 1024 * 1024)
const MAX_INPUT_PIXELS = 24_000_000
const MAX_DIMENSION = 2000

export const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
const MIME_TO_EXT: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' }

const tenantUsedBytes = new Map<string, number>()
const tenantInFlightBytes = new Map<string, number>()

function seedTenantUsage(tenantDir: string): number {
  try {
    return readdirSync(tenantDir).reduce((n, f) => {
      try { return n + statSync(join(tenantDir, f)).size } catch { return n }
    }, 0)
  } catch { return 0 }
}

// Riconosce il tipo immagine dai magic bytes reali (non dall'header, falsificabile).
export function sniffImageMime(buf: Buffer): string | null {
  if (buf.length < 12) return null
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg'
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'image/png'
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38) return 'image/gif'
  if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return 'image/webp'
  return null
}

export type SaveImageResult = { url: string } | { error: string; code: string }

// Valida (magic bytes) + re-encode (sharp) + quota + scrive su disco. Ritorna l'URL
// pubblico (/uploads/<rest>/<file>) o un errore leggibile. Buffer già in memoria
// (il chiamante impone il limite di dimensione: 10MB multipart, o il media WhatsApp).
export async function saveImageBuffer(restaurantId: string, buf: Buffer): Promise<SaveImageResult> {
  const realMime = sniffImageMime(buf)
  if (!realMime || !ALLOWED_MIME_TYPES.has(realMime)) {
    return { code: 'INVALID_FILE_CONTENT', error: 'Il contenuto del file non è un\'immagine valida (JPEG/PNG/WebP/GIF).' }
  }
  let out: Buffer
  try {
    const isGif = realMime === 'image/gif'
    const pipeline = sharp(buf, { limitInputPixels: MAX_INPUT_PIXELS, animated: isGif })
    const meta = await pipeline.metadata()
    if ((meta.width ?? 0) * (meta.height ?? 0) > MAX_INPUT_PIXELS) {
      return { code: 'INVALID_FILE_CONTENT', error: 'Immagine troppo grande (dimensioni in pixel eccessive).' }
    }
    const fmt = isGif ? 'gif' : realMime === 'image/png' ? 'png' : realMime === 'image/webp' ? 'webp' : 'jpeg'
    out = await pipeline
      .rotate()
      .resize({ width: MAX_DIMENSION, height: MAX_DIMENSION, fit: 'inside', withoutEnlargement: true })
      .toFormat(fmt)
      .toBuffer()
  } catch {
    return { code: 'INVALID_FILE_CONTENT', error: 'Il contenuto del file non è un\'immagine valida.' }
  }

  const tenantDir = join(UPLOADS_DIR, restaurantId)
  mkdirSync(tenantDir, { recursive: true })
  if (!tenantUsedBytes.has(restaurantId)) tenantUsedBytes.set(restaurantId, seedTenantUsage(tenantDir))
  const used = tenantUsedBytes.get(restaurantId) ?? 0
  const inFlight = tenantInFlightBytes.get(restaurantId) ?? 0
  if (used + inFlight + out.length > MAX_UPLOADS_BYTES) {
    return { code: 'STORAGE_FULL', error: 'Spazio immagini esaurito.' }
  }
  tenantInFlightBytes.set(restaurantId, inFlight + out.length)

  const filename = `${nanoid(16)}.${MIME_TO_EXT[realMime]!}`
  const filepath = join(tenantDir, filename)
  try {
    await new Promise<void>((resolve, reject) => {
      const ws = createWriteStream(filepath)
      ws.on('finish', resolve)
      ws.on('error', reject)
      ws.end(out)
    })
    tenantUsedBytes.set(restaurantId, (tenantUsedBytes.get(restaurantId) ?? 0) + out.length)
  } catch {
    return { code: 'WRITE_FAILED', error: 'Salvataggio immagine non riuscito.' }
  } finally {
    tenantInFlightBytes.set(restaurantId, (tenantInFlightBytes.get(restaurantId) ?? out.length) - out.length)
  }
  return { url: `/uploads/${restaurantId}/${filename}` }
}
