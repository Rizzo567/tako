import type { FastifyInstance } from 'fastify'
import { requireAuth } from '../middleware/auth.js'
import { saveImageBuffer } from '../lib/image-store.js'

// Upload immagine piatto. La pipeline (magic bytes + re-encode sharp + quota per
// ristorante) vive in lib/image-store così che ANCHE WhatsApp e il copilot la riusino.
export async function uploadRoutes(fastify: FastifyInstance) {
  fastify.post('/image', { preHandler: requireAuth }, async (req, reply) => {
    const data = await req.file()
    if (!data) return reply.code(400).send({ error: { code: 'NO_FILE', message: 'No file provided' } })
    // toBuffer rispetta il limite multipart (10MB) impostato in index.ts.
    const buf = await data.toBuffer()
    const res = await saveImageBuffer(req.user!.restaurantId, buf)
    if ('error' in res) {
      const status = res.code === 'STORAGE_FULL' ? 507 : 400
      return reply.code(status).send({ error: { code: res.code, message: res.error } })
    }
    return { data: { url: res.url } }
  })
}
