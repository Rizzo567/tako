import type { FastifyInstance } from 'fastify'
import { createWriteStream, mkdirSync } from 'fs'
import { join } from 'path'
import { nanoid } from 'nanoid'
import { requireAuth } from '../middleware/auth.js'

const UPLOADS_DIR = process.env['UPLOADS_DIR'] ?? './uploads'
mkdirSync(UPLOADS_DIR, { recursive: true })

export async function uploadRoutes(fastify: FastifyInstance) {
  fastify.post('/image', { preHandler: requireAuth }, async (req, reply) => {
    const data = await req.file()
    if (!data) return reply.code(400).send({ error: { code: 'NO_FILE', message: 'No file provided' } })

    const ext = data.filename.split('.').pop() ?? 'jpg'
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
