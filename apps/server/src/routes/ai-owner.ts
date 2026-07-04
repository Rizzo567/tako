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
    // Limiti TOLLERANTI: la dettatura produce messaggi lunghi e le risposte del
    // copilot possono superare i 2000 caratteri — un 400 qui rompeva la chat in modo
    // persistente (il messaggio lungo resta nella history delle 12 battute successive).
    // Accettiamo largo e TRONCHIAMO, invece di rifiutare.
    const schema = z.object({
      message: z.string().min(1).max(8000),
      history: z.array(z.object({ role: z.enum(['user', 'assistant']), content: z.string().max(20000) })).max(24).default([]),
    })
    const parsed = schema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: { code: 'VALIDATION', message: parsed.error.message } })
    const message = parsed.data.message.slice(0, 4000)
    const history = parsed.data.history.slice(-12).map(h => ({ role: h.role, content: h.content.slice(0, 2000) }))
    if (!process.env['GROQ_API_KEY']) return reply.code(503).send({ error: { code: 'AI_UNAVAILABLE', message: 'AI non configurata' } })

    const restaurantId = req.user!.restaurantId
    const [restaurant] = await db.select({ name: restaurants.name }).from(restaurants).where(eq(restaurants.id, restaurantId)).limit(1)

    const systemPrompt = `Sei Tako, il copilot operativo di "${restaurant?.name ?? 'questo ristorante'}" per lo staff.
Puoi LEGGERE dati reali: incassi (oggi/data), statistiche, rendimento menu, stato tavoli, ordini attivi, conti aperti, prenotazioni, scorte basse, chi è in turno, elenco staff, ricerca piatti.
Puoi PROPORRE modifiche (l'owner le conferma dalla dashboard): MENU (crea/modifica/elimina piatto, esaurito/disponibile, sezioni, varianti, food cost) · TAVOLI e SALE (crea/modifica/elimina tavolo, crea sala, stato libero/occupato/pulizia, rigenera QR) · PRENOTAZIONI (crea, annulla, cambia stato) · ORDINI (annulla) · CASSA (sconto, incassa e chiudi conto) · INVENTARIO (crea ingrediente, carico/scarico/spreco) · TURNI (inizio/fine per un membro) · STAFF (aggiungi, disattiva/riattiva) · coperto.
Le letture eseguile subito; le modifiche proponile con lo strumento e di' che attendono conferma.
REGOLA FERREA: puoi fare SOLO ciò per cui hai uno strumento. Senza strumento adatto NON fingere di aver fatto nulla, mai dire "fatto/creato": rispondi "Non posso ancora farlo da qui" e indica dove farlo nella dashboard. Mai inventare numeri o dati.
Se una richiesta è AMBIGUA (più piatti/tavoli/persone corrispondono, o mancano dati essenziali come l'orario di una prenotazione), NON tirare a indovinare: fai UNA domanda di chiarimento breve, elencando le opzioni se le conosci.
Rispondi in italiano, conciso e operativo.`

    try {
      const turn = await runAssistant({
        scope: 'owner',
        ctx: { restaurantId, role: req.user!.role },
        systemPrompt,
        history,
        userMessage: message,
      })
      return { data: { message: turn.message, actions: turn.actions, pending: turn.pending } }
    } catch (err: any) {
      if (err?.code === 'AI_UNAVAILABLE') return reply.code(503).send({ error: { code: 'AI_UNAVAILABLE', message: 'AI non configurata' } })
      // Quota/limiti del provider (429 su entrambi i modelli, 413 TPM): non è un
      // guasto — di' all'utente di riprovare tra poco, con lo status giusto per la UI.
      if (err?.status === 429 || err?.status === 413 || err?.code === 'rate_limit_exceeded') {
        return reply.code(429).send({ error: { code: 'AI_RATE_LIMITED', message: 'Copilot al limite di utilizzo: riprova tra un minuto.' } })
      }
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
