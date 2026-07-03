// ─────────────────────────── Tako — OWNER COPILOT (AI) ───────────────────────────
// Endpoint staff per il copilot dell'owner (pannello Cmd+K nella dashboard). Usa il
// motore azioni condiviso (lib/ai-actions) in scope 'owner'. Due fasi nette:
//   POST /ai/owner/chat    → l'AI risponde e PROPONE le azioni mutanti (non le esegue).
//   POST /ai/owner/execute → esegue UNA azione confermata esplicitamente dall'owner.
// Le letture (incasso, stats, stato tavoli, ricerca menu) girano subito nella chat;
// le modifiche (segna esaurito, crea/modifica/elimina piatto, elimina/rinomina
// sezione) richiedono la conferma umana.
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { db, restaurants } from '@tako/db'
import { eq } from 'drizzle-orm'
import { requireAuth } from '../middleware/auth.js'
import { runAssistant, executeAction, getAction } from '../lib/ai-actions.js'

export async function aiOwnerRoutes(fastify: FastifyInstance) {
  // Chat del copilot. Rate-limit per-ristorante (Groq costoso).
  fastify.post('/chat', {
    preHandler: requireAuth,
    config: { rateLimit: { max: 20, timeWindow: 60000, keyGenerator: (req: any) => req.user?.restaurantId ?? req.ip } },
  }, async (req, reply) => {
    const schema = z.object({
      message: z.string().min(1).max(500),
      history: z.array(z.object({ role: z.enum(['user', 'assistant']), content: z.string().max(2000) })).max(12).default([]),
    })
    const parsed = schema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: { code: 'VALIDATION', message: parsed.error.message } })
    if (!process.env['GROQ_API_KEY']) return reply.code(503).send({ error: { code: 'AI_UNAVAILABLE', message: 'AI non configurata' } })

    const restaurantId = req.user!.restaurantId
    const [restaurant] = await db.select({ name: restaurants.name }).from(restaurants).where(eq(restaurants.id, restaurantId)).limit(1)

    const systemPrompt = `Sei Tako, il copilot operativo di "${restaurant?.name ?? 'questo ristorante'}" per lo staff.
Puoi LEGGERE dati reali (incasso di oggi, statistiche, stato tavoli, cercare piatti) e PROPORRE modifiche al menu: segnare un piatto esaurito o disponibile, creare un piatto, MODIFICARE un piatto (prezzo, nome, descrizione), ELIMINARE un piatto, ELIMINARE o RINOMINARE una sezione.
Le azioni che MODIFICANO dati non vengono eseguite subito: le proponi con lo strumento e l'owner le conferma dalla dashboard. Le letture invece falle subito.
Rispondi in italiano, conciso e operativo. Non inventare numeri o piatti: usa sempre gli strumenti.`

    try {
      const turn = await runAssistant({
        scope: 'owner',
        ctx: { restaurantId, role: req.user!.role },
        systemPrompt,
        history: parsed.data.history,
        userMessage: parsed.data.message,
      })
      return { data: { message: turn.message, actions: turn.actions, pending: turn.pending } }
    } catch (err: any) {
      if (err?.code === 'AI_UNAVAILABLE') return reply.code(503).send({ error: { code: 'AI_UNAVAILABLE', message: 'AI non configurata' } })
      fastify.log.error(err, 'owner copilot chat error')
      return reply.code(502).send({ error: { code: 'AI_ERROR', message: 'Copilot non disponibile, riprova.' } })
    }
  })

  // Esegue UNA azione confermata. Ri-valida scope + ownership dentro il motore
  // (allowMutation:true SOLO qui, dopo la conferma esplicita dell'owner).
  fastify.post('/execute', {
    preHandler: requireAuth,
    config: { rateLimit: { max: 40, timeWindow: 60000, keyGenerator: (req: any) => req.user?.restaurantId ?? req.ip } },
  }, async (req, reply) => {
    const schema = z.object({ name: z.string().min(1).max(64), args: z.record(z.string(), z.any()).default({}) })
    const parsed = schema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: { code: 'VALIDATION', message: parsed.error.message } })

    const def = getAction(parsed.data.name)
    if (!def || !def.scope.includes('owner')) {
      return reply.code(400).send({ error: { code: 'UNKNOWN_ACTION', message: 'Azione non disponibile.' } })
    }
    try {
      const result = await executeAction(parsed.data.name, parsed.data.args, { restaurantId: req.user!.restaurantId, role: req.user!.role }, 'owner', { allowMutation: true })
      req.log.info({ userId: req.user!.id, action: parsed.data.name, ok: result.ok }, 'owner copilot execute')
      if (!result.ok) return reply.code(422).send({ error: { code: 'ACTION_FAILED', message: result.summary } })
      return { data: result }
    } catch (err: any) {
      fastify.log.error(err, 'owner copilot execute error')
      return reply.code(502).send({ error: { code: 'ACTION_ERROR', message: 'Esecuzione non riuscita.' } })
    }
  })
}
