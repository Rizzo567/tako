// Avvio del CONTROL-PLANE cloud (TAKO_MODE=cloud). SEPARATO da index.ts (modo local),
// che resta invariato. Monta CORS allowlist esatta, rate-limit con store Redis condiviso,
// e le route cloud (/api/auth + /api/pair).
//
// FASE 5e: `buildCloudApp()` (costruisce e registra tutto, NIENTE listen) è estratto da
// `startCloudServer()` (build + listen) per testabilità: un test può montare l'app reale
// senza aprire un socket. Il comportamento d'avvio è invariato.
import Fastify, { type FastifyInstance } from 'fastify'
import cors from '@fastify/cors'
import cookie from '@fastify/cookie'
import rateLimit from '@fastify/rate-limit'
import helmet from '@fastify/helmet'
import { Redis } from 'ioredis'
import { cloudAuthRoutes } from '../routes/cloud/auth.js'
import { cloudOAuthRoutes } from '../routes/cloud/oauth.js'
import { cloudPairRoutes } from '../routes/cloud/pair.js'
import { cloudContactRoutes } from '../routes/cloud/contact.js'
import { allowedOrigins, cookieMode } from './config.js'
import { validateEmailConfig } from './email.js'
import { setRedis } from './redis.js'

// bodyLimit del control-plane (NEW-02): i payload JSON auth/pairing sono piccoli.
const CLOUD_BODY_LIMIT = 32 * 1024 // 32 KiB

// trustProxy: il cloud sta DIETRO un reverse proxy (Vercel/Fly/Nginx). req.ip va derivato
// dall'header X-Forwarded-For SOLO se il proxy è fidato. TRUST_PROXY può essere 'true', un
// hop count, o una lista di CIDR fidati. Default: 1 hop (il proxy immediato). NON usare
// 'true' indiscriminato in produzione: consente lo spoofing dell'IP da parte del client se
// non c'è un proxy che riscrive l'header.
function resolveTrustProxy(): boolean | number | string {
  const trustProxyEnv = process.env['TRUST_PROXY']
  return trustProxyEnv === undefined ? 1
    : trustProxyEnv === 'true' ? true
    : /^\d+$/.test(trustProxyEnv) ? Number(trustProxyEnv)
    : trustProxyEnv
}

function buildCloudFastify(trustProxy: boolean | number | string): FastifyInstance {
  return Fastify({ logger: { level: 'error' }, trustProxy, bodyLimit: CLOUD_BODY_LIMIT })
}

/**
 * Costruisce l'app cloud reale (CORS, cookie, helmet, rate-limit, error handler, route)
 * SENZA chiamare `listen()`. Usata da `startCloudServer()` e disponibile per i test.
 * Effetti collaterali: valida la config (SESSION_SECRET, email) e inietta il client Redis
 * condiviso in `redis.ts` (così lockout/quota/nonce usano lo STESSO Redis del rate-limit).
 */
export async function buildCloudApp(): Promise<FastifyInstance> {
  // SESSION_SECRET firma i cookie (firma anti-tamper di @fastify/cookie). DISTINTO da
  // JWT_SECRET locale: il control-plane non condivide segreti con l'appliance.
  const SESSION_SECRET = process.env['SESSION_SECRET']
  if (!SESSION_SECRET) throw new Error('SESSION_SECRET è obbligatoria in TAKO_MODE=cloud')
  if (process.env['NODE_ENV'] === 'production' && SESSION_SECRET.length < 32) {
    throw new Error('SESSION_SECRET deve essere lungo almeno 32 caratteri in produzione')
  }

  // Fail-fast sulla config email: se EMAIL_TRANSPORT=resend la RESEND_API_KEY è obbligatoria.
  validateEmailConfig()

  const fastify = buildCloudFastify(resolveTrustProxy())

  await fastify.register(helmet, {
    contentSecurityPolicy: {
      useDefaults: true,
      directives: { defaultSrc: ["'self'"], frameAncestors: ["'none'"] },
    },
  })

  // CORS: allowlist ESATTA da ALLOWED_ORIGINS. Mai origin:true, mai suffix-match.
  const origins = allowedOrigins()
  await fastify.register(cors, {
    origin: (origin, cb) => {
      // Richieste senza Origin (curl, health, server-to-server) ammesse: il cookie
      // non viaggia comunque senza un browser che imposti l'Origin.
      if (!origin) return cb(null, true)
      if (origins.includes(origin)) return cb(null, true)
      // Origin non in allowlist: NON impostare gli header CORS (il browser blocca).
      // Niente errore 500: rispondiamo normalmente ma senza Access-Control-Allow-Origin.
      return cb(null, false)
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'X-Tako-CSRF'],
  })

  await fastify.register(cookie, { secret: SESSION_SECRET })

  // Rate-limit con store Redis CONDIVISO (REDIS_URL): coerente tra più istanze/repliche
  // del control-plane. La chiave è req.ip (derivato dal proxy fidato sopra). Lo STESSO
  // client viene iniettato in redis.ts per i freni anti-abuso (lockout/quota/nonce).
  const redisUrl = process.env['REDIS_URL']
  const redis = redisUrl ? new Redis(redisUrl, { connectTimeout: 5000, maxRetriesPerRequest: 1 }) : undefined
  if (redis) {
    redis.on('error', () => { /* swallow: il rate-limit/gli helper degradano */ })
    setRedis(redis)
  } else {
    setRedis(null)
    fastify.log.error('REDIS_URL non impostata: rate-limit/lockout cloud usano un fallback in-memory (non condiviso tra repliche).')
  }
  await fastify.register(rateLimit, {
    global: false, // limiti per-route (vedi onRoute hook sotto)
    redis,
    keyGenerator: (req) => req.ip,
    errorResponseBuilder: () => ({
      error: { code: 'RATE_LIMIT', message: 'Troppe richieste. Riprova più tardi.' },
    }),
  })

  // Error handler: NON esporre stack/dettagli interni al client (OWASP A05/A09).
  // Logga il dettaglio server-side, risponde generico. Validazioni/errori espliciti
  // delle route usano già reply.code(...).send(...) e non passano di qui.
  fastify.setErrorHandler((err, req, reply) => {
    const status = (err as { statusCode?: number }).statusCode ?? 500
    req.log.error({ err }, 'cloud unhandled error')
    if (status >= 500) {
      return reply.code(500).send({ error: { code: 'SERVER_ERROR', message: 'Errore interno. Riprova più tardi.' } })
    }
    const message = err instanceof Error ? err.message : 'Richiesta non valida'
    return reply.code(status).send({ error: { code: 'ERROR', message } })
  })

  fastify.get('/health', async () => ({ status: 'ok', mode: 'cloud', cookieMode: cookieMode(), ts: new Date().toISOString() }))

  // Favicon: il control-plane è un'API, ma i browser (e Google) chiedono /favicon.ico.
  // Rimandiamo al logo Tako servito dal sito, così anche la scheda di api.takoitalia.com
  // mostra l'icona Tako.
  fastify.get('/favicon.ico', async (_req, reply) => reply.redirect('https://takoitalia.com/favicon.ico', 301))

  // Rate-limit per-endpoint. Due classi (NEW-01 FASE 5e):
  //  - SENSITIVE_AUTH: endpoint auth che spediscono email / verificano credenziali → 10/min.
  //  - SENSITIVE_PAIR: endpoint pairing non autenticati o ad alta frequenza. claim/heartbeat
  //    sono i più esposti (no sessione owner) → 30/min per-IP; code/approve passano comunque
  //    dal rate-limit globale per-IP via questa classe (30/min) oltre alla sessione+CSRF.
  const SENSITIVE_AUTH = new Set([
    'POST:/api/auth/login',
    'POST:/api/auth/register',
    'POST:/api/auth/forgot-password',
    'POST:/api/auth/resend-verification',
    'POST:/api/auth/reset-password',
    'POST:/api/auth/verify-email',
    'GET:/api/auth/verify-email',
    'POST:/api/contact',
  ])
  const SENSITIVE_PAIR = new Set([
    'POST:/api/pair/claim',
    'POST:/api/pair/heartbeat',
    'POST:/api/pair/code',
    'POST:/api/pair/approve',
  ])
  fastify.addHook('onRoute', (routeOptions) => {
    const methods = Array.isArray(routeOptions.method) ? routeOptions.method : [routeOptions.method]
    const keys = methods.map((m) => `${m}:${routeOptions.url}`)
    if (keys.some((k) => SENSITIVE_AUTH.has(k))) {
      routeOptions.config = { ...(routeOptions.config ?? {}), rateLimit: { max: 10, timeWindow: '1 minute' } }
    } else if (keys.some((k) => SENSITIVE_PAIR.has(k))) {
      // claim/heartbeat non hanno sessione: il per-IP è la prima linea di difesa (oltre al
      // per-code lockout e al PoP ed25519). 30/min/IP è ampio per un'appliance legittima.
      routeOptions.config = { ...(routeOptions.config ?? {}), rateLimit: { max: 30, timeWindow: '1 minute' } }
    }
  })

  await fastify.register(cloudAuthRoutes, { prefix: '/api/auth' })
  // OAuth montato sotto lo stesso prefix /api/auth (start path /google,/github →
  // /api/auth/google, callback → /api/auth/google/callback). Si registra solo se i
  // provider sono configurati (client id/secret in env), altrimenti è un no-op.
  await fastify.register(cloudOAuthRoutes, { prefix: '/api/auth' })
  await fastify.register(cloudPairRoutes, { prefix: '/api/pair' })
  await fastify.register(cloudContactRoutes, { prefix: '/api' })

  return fastify
}

export async function startCloudServer(): Promise<void> {
  const PORT = Number(process.env['PORT'] ?? 3001)
  const fastify = await buildCloudApp()
  const origins = allowedOrigins()

  try {
    await fastify.listen({ port: PORT, host: '0.0.0.0' })
    console.log(`Tako CLOUD control-plane in ascolto su http://0.0.0.0:${PORT} (cookieMode=${cookieMode()}, origins=${origins.length})`)
  } catch (err) {
    console.error(err)
    process.exit(1)
  }
}
