// Avvio del CONTROL-PLANE cloud (TAKO_MODE=cloud). SEPARATO da index.ts (modo local),
// che resta invariato. Monta CORS allowlist esatta, rate-limit con store Redis condiviso,
// e le route cloud (/api/auth + placeholder /api/pair).
import Fastify from 'fastify'
import cors from '@fastify/cors'
import cookie from '@fastify/cookie'
import rateLimit from '@fastify/rate-limit'
import helmet from '@fastify/helmet'
import { Redis } from 'ioredis'
import { cloudAuthRoutes } from '../routes/cloud/auth.js'
import { cloudPairRoutes } from '../routes/cloud/pair.js'
import { allowedOrigins, cookieMode } from './config.js'

export async function startCloudServer(): Promise<void> {
  const PORT = Number(process.env['PORT'] ?? 3001)

  // SESSION_SECRET firma i cookie (firma anti-tamper di @fastify/cookie). DISTINTO da
  // JWT_SECRET locale: il control-plane non condivide segreti con l'appliance.
  const SESSION_SECRET = process.env['SESSION_SECRET']
  if (!SESSION_SECRET) throw new Error('SESSION_SECRET è obbligatoria in TAKO_MODE=cloud')
  if (process.env['NODE_ENV'] === 'production' && SESSION_SECRET.length < 32) {
    throw new Error('SESSION_SECRET deve essere lungo almeno 32 caratteri in produzione')
  }

  // trustProxy: il cloud sta DIETRO un reverse proxy (Vercel/Fly/Nginx). req.ip va
  // derivato dall'header X-Forwarded-For SOLO se il proxy è fidato. TRUST_PROXY può
  // essere 'true', un hop count, o una lista di CIDR fidati. Default: 1 hop (il proxy
  // immediato). NON usare 'true' indiscriminato in produzione: consente lo spoofing
  // dell'IP da parte del client se non c'è un proxy che riscrive l'header.
  const trustProxyEnv = process.env['TRUST_PROXY']
  const trustProxy: boolean | number | string =
    trustProxyEnv === undefined ? 1
    : trustProxyEnv === 'true' ? true
    : /^\d+$/.test(trustProxyEnv) ? Number(trustProxyEnv)
    : trustProxyEnv

  const fastify = Fastify({ logger: { level: 'error' }, trustProxy })

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
  // del control-plane. La chiave è req.ip (derivato dal proxy fidato sopra).
  const redisUrl = process.env['REDIS_URL']
  const redis = redisUrl ? new Redis(redisUrl, { connectTimeout: 5000, maxRetriesPerRequest: 1 }) : undefined
  if (!redis) {
    fastify.log.error('REDIS_URL non impostata: il rate-limit cloud userà un fallback in-memory (non condiviso).')
  }
  await fastify.register(rateLimit, {
    global: false, // limiti per-route (vedi config.rateLimit sotto)
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

  // Route cloud. I limiti per-endpoint sensibili sono dichiarati DENTRO le route via
  // config.rateLimit? No: @fastify/rate-limit per-route si configura con un wrapper.
  // Per semplicità e robustezza applichiamo un onRoute hook che imposta i limiti sugli
  // endpoint auth sensibili.
  const SENSITIVE = new Set([
    'POST:/api/auth/login',
    'POST:/api/auth/register',
    'POST:/api/auth/forgot-password',
    'POST:/api/auth/resend-verification',
    'POST:/api/auth/reset-password',
    'POST:/api/auth/verify-email',
    'GET:/api/auth/verify-email',
  ])
  fastify.addHook('onRoute', (routeOptions) => {
    const methods = Array.isArray(routeOptions.method) ? routeOptions.method : [routeOptions.method]
    const isSensitive = methods.some((m) => SENSITIVE.has(`${m}:${routeOptions.url}`))
    if (isSensitive) {
      routeOptions.config = {
        ...(routeOptions.config ?? {}),
        rateLimit: { max: 10, timeWindow: '1 minute' },
      }
    }
  })

  await fastify.register(cloudAuthRoutes, { prefix: '/api/auth' })
  await fastify.register(cloudPairRoutes, { prefix: '/api/pair' })

  try {
    await fastify.listen({ port: PORT, host: '0.0.0.0' })
    console.log(`Tako CLOUD control-plane in ascolto su http://0.0.0.0:${PORT} (cookieMode=${cookieMode()}, origins=${origins.length})`)
  } catch (err) {
    console.error(err)
    process.exit(1)
  }
}
