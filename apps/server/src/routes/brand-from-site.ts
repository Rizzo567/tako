import type { FastifyInstance, FastifyReply, FastifyRequest, preHandlerHookHandler } from 'fastify'
import { z } from 'zod'
import { requireRole } from '../middleware/auth.js'
import { createUserRateLimiter, extractSiteBrand, SiteBrandError, type SiteBrand } from '../lib/site-brand.js'

/** Opzioni iniettabili SOLO dal codice (test): mai da richiesta HTTP o env. */
export interface BrandFromSiteOptions {
  preHandler?: preHandlerHookHandler
  extract?: (url: string) => Promise<SiteBrand>
  limiter?: ReturnType<typeof createUserRateLimiter>
}

const body = z.object({ url: z.string().trim().min(1).max(2048) })

/**
 * POST /brand-from-site (registrata sotto /api/menu-workspace): colori e logo dal
 * sito pubblico del cliente. Ruoli con capability `style` (owner, menu_editor);
 * passa dall'origin guard di web-runtime come ogni altra POST.
 */
export async function brandFromSiteRoutes(fastify: FastifyInstance, opts: BrandFromSiteOptions = {}) {
  const auth = opts.preHandler ?? (requireRole('owner', 'menu_editor') as preHandlerHookHandler)
  const limiter = opts.limiter ?? createUserRateLimiter({ max: 6, windowMs: 60_000 })
  const extract = opts.extract ?? ((url: string) => extractSiteBrand(url))
  fastify.post('/brand-from-site', { preHandler: auth }, async (req: FastifyRequest, reply: FastifyReply) => {
    const userId = req.user?.id
    if (!userId) return reply.code(401).send({ error: { code: 'UNAUTHORIZED', message: 'Accesso richiesto.' } })
    const limit = limiter.hit(userId)
    if (!limit.ok) {
      return reply.code(429).header('Retry-After', String(limit.retryAfterSec))
        .send({ error: { code: 'RATE_LIMIT', message: `Troppe richieste: riprova tra ${limit.retryAfterSec} secondi.` } })
    }
    const parsed = body.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: { code: 'VALIDATION', message: 'Indica l’indirizzo del sito del locale.' } })
    try {
      return { data: await extract(parsed.data.url) }
    } catch (e) {
      if (e instanceof SiteBrandError) return reply.code(e.status).send({ error: { code: e.code, message: e.message } })
      // Mai 500 per problemi del sito remoto: qualunque errore inatteso dell'estrazione è «irraggiungibile».
      req.log.warn({ err: e }, 'brand-from-site: estrazione fallita')
      return reply.code(422).send({ error: { code: 'SITE_UNREACHABLE', message: 'Impossibile leggere il sito. Riprova tra poco.' } })
    }
  })
}
