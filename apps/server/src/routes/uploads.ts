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

export async function uploadRoutes(fastify: FastifyInstance) {
  fastify.post('/image', { preHandler: requireAuth }, async (req, reply) => {
    const data = await req.file()
    if (!data) return reply.code(400).send({ error: { code: 'NO_FILE', message: 'No file provided' } })

    const mimeType = data.mimetype
    if (!ALLOWED_MIME_TYPES.has(mimeType)) {
      return reply.code(400).send({ error: { code: 'INVALID_FILE_TYPE', message: 'Only JPEG, PNG, WebP and GIF images are allowed' } })
    }

    const ext = MIME_TO_EXT[mimeType]!
    const filename = `${nanoid(16)}.${ext}`
    const filepath = join(UPLOADS_DIR, filename)

    await new Promise<void>((resolve, reject) => {
      const ws = createWriteStream(filepath)
      data.file.pipe(ws)
      ws.on('finish', resolve)
      ws.on('error', reject)
    })

    const url = `/uploads/${filename}`
    return { data: { url } }
  })
}
