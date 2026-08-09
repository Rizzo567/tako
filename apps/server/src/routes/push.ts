// ───────────────────────── Tako — API delle notifiche push (F3.1) ─────────────────────────
//
// Quattro route, tutte autenticate. Il telefono le usa così:
//   GET  /api/push/key        → la chiave pubblica VAPID da dare a pushManager.subscribe()
//   POST /api/push/subscribe  → registra la subscription, LEGATA alla sessione corrente
//   DELETE /api/push/subscribe → disiscrizione esplicita (il ristoratore spegne le notifiche)
//   POST /api/push/test       → owner: "fammi sentire se arriva davvero"
//
// Il legame subscription↔sessione è la chiave di tutto: la riga vive in
// `push_subscriptions` con `session_id ... ON DELETE CASCADE`, quindi revocare il
// telefono da "Dispositivi" spegne le notifiche senza che questa route ne sappia nulla.
// Per questo qui si risolve la SESSIONE, non solo l'utente: `req.user` non porta con
// sé l'id di sessione, e legarsi all'utente vorrebbe dire che revocare UN telefono
// zittisce anche gli altri dello stesso proprietario.
import type { FastifyInstance, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { db, pushSubscriptions, sessions } from '@tako/db'
import { and, eq, gt } from 'drizzle-orm'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { SESSION_COOKIE } from '../lib/cookies.js'
import { getVapidPublicKey, pushDispatch } from '../lib/push.js'

/** Id della sessione che sta facendo la richiesta (requireAuth l'ha già validata). */
async function currentSessionId(req: FastifyRequest): Promise<string | null> {
  const token = req.cookies?.[SESSION_COOKIE] ?? req.headers.authorization?.replace('Bearer ', '')
  if (!token) return null
  const [row] = await db.select({ id: sessions.id })
    .from(sessions)
    .where(and(eq(sessions.token, token), gt(sessions.expiresAt, new Date())))
    .limit(1)
  return row?.id ?? null
}

// La subscription è esattamente ciò che il browser restituisce da
// `PushSubscription.toJSON()`. I due cap di lunghezza non sono paranoia: l'endpoint
// finisce in una colonna UNIQUE e le chiavi in un header crittografico.
const subscribeSchema = z.object({
  endpoint: z.string().url().max(2000),
  keys: z.object({
    p256dh: z.string().min(1).max(200),
    auth: z.string().min(1).max(100),
  }),
})

export async function pushRoutes(fastify: FastifyInstance) {
  // ─── GET /key — chiave pubblica VAPID ──────────────────────────────────────────
  // Pubblica per definizione (finisce in ogni subscription), ma dietro autenticazione
  // come tutto il resto: da remoto il gate di F1.3 risponde 404 a chi non ha sessione,
  // e non c'è motivo di fare un'eccezione per un dato che serve solo all'app.
  fastify.get('/key', { preHandler: requireAuth }, async (_req, reply) => {
    const publicKey = getVapidPublicKey()
    if (!publicKey) {
      // Nessuna chiave = notifiche non disponibili su questa appliance (disco in sola
      // lettura). 503 e non 500: non è un errore, è una capacità assente.
      return reply.code(503).send({ error: { code: 'PUSH_UNAVAILABLE', message: 'Notifiche non disponibili su questa appliance.' } })
    }
    return { data: { publicKey } }
  })

  // ─── POST /subscribe — registra la subscription ────────────────────────────────
  // UPSERT sull'endpoint: il browser ri-sottoscrive a ogni avvio dell'app e deve
  // trovare la sua riga, non crearne una nuova ogni volta. L'upsert riassegna anche
  // `session_id`: se lo stesso telefono viene ri-arruolato, la subscription segue la
  // sessione nuova invece di restare appesa a una morta.
  fastify.post('/subscribe', { preHandler: requireAuth }, async (req, reply) => {
    const parsed = subscribeSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: { code: 'VALIDATION', message: 'Subscription non valida.' } })

    const sessionId = await currentSessionId(req)
    if (!sessionId) return reply.code(401).send({ error: { code: 'UNAUTHORIZED', message: 'Sessione non trovata.' } })

    const ua = String(req.headers['user-agent'] ?? '').slice(0, 300) || null
    const values = {
      restaurantId: req.user!.restaurantId,
      sessionId,
      endpoint: parsed.data.endpoint,
      p256dh: parsed.data.keys.p256dh,
      auth: parsed.data.keys.auth,
      userAgent: ua,
    }
    const [row] = await db.insert(pushSubscriptions).values(values)
      .onConflictDoUpdate({
        target: pushSubscriptions.endpoint,
        set: {
          restaurantId: values.restaurantId,
          sessionId,
          p256dh: values.p256dh,
          auth: values.auth,
          userAgent: ua,
          failCount: 0,
        },
      })
      .returning({ id: pushSubscriptions.id })

    return reply.code(201).send({ data: { id: row?.id ?? null } })
  })

  // ─── DELETE /subscribe — disiscrizione ─────────────────────────────────────────
  // L'endpoint viaggia in QUERY, non nel corpo: una DELETE con Content-Type JSON e
  // corpo vuoto riceve 400 da Fastify prima ancora di entrare nella route (trappola
  // già incontrata tre volte in F2). Senza `endpoint` si cancellano tutte le
  // subscription di QUESTO dispositivo — è ciò che serve al pulsante "spegni le
  // notifiche su questo telefono".
  fastify.delete('/subscribe', { preHandler: requireAuth }, async (req, reply) => {
    const q = z.object({ endpoint: z.string().max(2000).optional() }).safeParse(req.query)
    if (!q.success) return reply.code(400).send({ error: { code: 'VALIDATION', message: 'Parametri non validi.' } })

    const sessionId = await currentSessionId(req)
    if (!sessionId) return reply.code(401).send({ error: { code: 'UNAUTHORIZED', message: 'Sessione non trovata.' } })

    // Sempre scoped alla sessione corrente: un dispositivo non può disiscrivere
    // il telefono di un collega conoscendone l'endpoint.
    const where = q.data.endpoint
      ? and(eq(pushSubscriptions.sessionId, sessionId), eq(pushSubscriptions.endpoint, q.data.endpoint))
      : eq(pushSubscriptions.sessionId, sessionId)
    const removed = await db.delete(pushSubscriptions).where(where).returning({ id: pushSubscriptions.id })
    return { data: { removed: removed.length } }
  })

  // ─── POST /test — invio di prova ───────────────────────────────────────────────
  // Owner-only e con rate limit: è l'unica route che spedisce push su richiesta, e
  // spedire è l'unica azione di questo file che costa qualcosa a qualcun altro
  // (il push service). Il risultato riporta i numeri veri, incluso lo `skipped`:
  // "0 inviate perché l'appliance è offline" è un'informazione, non un errore.
  fastify.post('/test', {
    config: { rateLimit: { max: 6, timeWindow: 60_000 } },
    preHandler: requireRole('owner'),
  }, async (req) => {
    const result = await pushDispatch(req.user!.restaurantId, {
      title: 'Tako',
      body: 'Le notifiche funzionano. Da qui in poi ti avviso io.',
      url: '/owner/#altro',
      tag: 'test',
      kind: 'test',
    })
    return { data: result }
  })
}
