import type { FastifyInstance } from 'fastify'
import { createWriteStream, mkdirSync } from 'fs'
import { join } from 'path'
import { nanoid } from 'nanoid'
import { requireAuth } from '../middleware/auth.js'

const UPLOADS_DIR = process.env['UPLOADS_DIR'] ?? './uploads'
mkdirSync(UPLOADS_DIR, { recursive: true })

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

    // Usa l'estensione dal tipo REALE, non da quello dichiarato dal client.
    const ext = MIME_TO_EXT[realMime]!
    const filename = `${nanoid(16)}.${ext}`
    const filepath = join(UPLOADS_DIR, filename)

    await new Promise<void>((resolve, reject) => {
      const ws = createWriteStream(filepath)
      ws.on('finish', resolve)
      ws.on('error', reject)
      ws.end(buf)
    })

    const url = `/uploads/${filename}`
    return { data: { url } }
  })
}
