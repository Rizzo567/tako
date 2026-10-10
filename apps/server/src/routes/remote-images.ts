import type { FastifyInstance } from 'fastify'
import { Readable } from 'node:stream'
import { downloadRemoteImage, imageObjectKey } from '../lib/remote-image-store.js'

/** Public menu photos only. No listing endpoint; writes use authenticated /api/uploads/image. */
export async function remoteImageRoutes(fastify: FastifyInstance) {
  fastify.get('/uploads/:restaurantId/:filename', async (request, reply) => {
    const { restaurantId, filename } = request.params as { restaurantId: string; filename: string }
    try { imageObjectKey(restaurantId, filename) } catch { return reply.code(404).send() }
    try {
      const response = await downloadRemoteImage(restaurantId, filename)
      if (!response.ok || !response.body) return reply.code(response.status === 404 ? 404 : 502).send()
      const mime = response.headers.get('content-type')?.split(';')[0] ?? ''
      if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(mime)) return reply.code(502).send()
      reply.header('Cache-Control', 'public, max-age=31536000, immutable')
      reply.header('X-Content-Type-Options', 'nosniff')
      return reply.type(mime).send(Readable.fromWeb(response.body as import('node:stream/web').ReadableStream))
    } catch { return reply.code(502).send() }
  })
}
