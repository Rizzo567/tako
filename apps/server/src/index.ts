import Fastify, { type FastifyServerOptions } from 'fastify'
import cors from '@fastify/cors'
import jwt from '@fastify/jwt'
import cookie from '@fastify/cookie'
import multipart from '@fastify/multipart'
import rateLimit from '@fastify/rate-limit'
import helmet from '@fastify/helmet'
import fastifyStatic from '@fastify/static'
import { resolve, dirname } from 'path'
import { mkdirSync, existsSync } from 'fs'
import { fileURLToPath } from 'url'
import { Server as SocketServer } from 'socket.io'
import { setupSocketHandlers } from './socket/handlers.js'
import { setupDictationNamespace } from './socket/dictation.js'
import { warmupAsr } from './lib/asr.js'
import { authRoutes } from './routes/auth.js'
import { setupRoutes, startHeartbeatLoop } from './routes/setup.js'
import { restaurantRoutes } from './routes/restaurants.js'
import { menuRoutes } from './routes/menu.js'
import { tableRoutes } from './routes/tables.js'
import { orderRoutes } from './routes/orders.js'
import { billRoutes } from './routes/bills.js'
import { inventoryRoutes } from './routes/inventory.js'
import { statsRoutes } from './routes/stats.js'
import { customerRoutes } from './routes/customer.js'
import { uploadRoutes } from './routes/uploads.js'
import { staffRoutes } from './routes/staff.js'
import { insightsRoutes } from './routes/insights.js'
import { printRoutes } from './routes/print.js'
import { systemRoutes } from './routes/system.js'
import { reservationRoutes } from './routes/reservations.js'
import { shiftRoutes } from './routes/shifts.js'
import { menuI18nRoutes } from './routes/menu-i18n.js'
import { aiOwnerRoutes } from './routes/ai-owner.js'
import { whatsappRoutes } from './routes/whatsapp.js'
import { startWhatsApp } from './lib/whatsapp.js'
import { startConnectivityMonitor, onConnectivityChange } from './lib/connectivity.js'
import { getNetworkHealth } from './lib/net-health.js'
import { startMdns } from './lib/mdns.js'
import { getLanIPv4s } from './lib/network.js'
import { httpsEnabled, ensureTlsMaterial } from './lib/tls.js'
import { isCloudMode } from './cloud/config.js'
import { startCloudServer } from './cloud/server.js'

// Socket.io condiviso con le route (import { io } from '../index.js'). Assegnato
// dentro startServer(); live binding ESM → le route lo vedono valorizzato a runtime.
export let io: SocketServer

// Avvio del server. È una FUNZIONE (non codice top-level) così bootstrap.ts può
// avviare prima il DB e poi chiamarla, con import statici (bundle-friendly).
export async function startServer(): Promise<void> {
  // Switch di modo: in TAKO_MODE=cloud montiamo il control-plane (route cloud,
  // CORS allowlist, rate-limit Redis) e ci fermiamo qui. Il modo local (default)
  // prosegue sotto INVARIATO.
  if (isCloudMode()) {
    await startCloudServer()
    return
  }

  const PORT = Number(process.env['PORT'] ?? 3001)
  const JWT_SECRET = process.env['JWT_SECRET']
  if (!JWT_SECRET) throw new Error('JWT_SECRET env variable is required')
  // Lo stesso segreto firma sessioni staff, JWT tavolo e cookie firmati: un valore
  // debole permette il forging. In produzione esigi ≥32 caratteri.
  if (process.env['NODE_ENV'] === 'production' && JWT_SECRET.length < 32) {
    throw new Error('JWT_SECRET deve essere lungo almeno 32 caratteri in produzione')
  }

  // HTTPS opt-in (TAKO_HTTPS=1): l'appliance serve https/wss così il tablet ottiene un
  // "secure context" e sblocca getUserMedia (dettatura vocale). Cert self-signed locale
  // generato/persistito in ~/.tako/tls (vedi lib/tls.ts). Default OFF → dev e i test di
  // integrazione continuano su http://localhost:3001 invariati. Porta e resto identici.
  let useHttps = httpsEnabled()
  const fastifyOptions: FastifyServerOptions = { logger: { level: 'error' } }
  if (useHttps) {
    // `https` è passato a node https.createServer (key/cert Buffer). Lo attacchiamo via
    // cast: il tipo restituito resta l'istanza http di default → tutte le .register/.get
    // sotto mantengono un tipo uniforme, mentre a runtime nasce un server https/wss.
    // Se la preparazione del materiale TLS fallisce (openssl assente, permessi, cert
    // corrotto), NON far crashare l'avvio: si ripiega su http così il server resta vivo.
    try {
      ;(fastifyOptions as FastifyServerOptions & { https: unknown }).https = ensureTlsMaterial()
    } catch (err) {
      console.warn('[tls] preparazione TLS fallita, ripiego su http:', (err as Error)?.message ?? err)
      useHttps = false
    }
  }
  const fastify = Fastify(fastifyOptions)

  // Error handler globale: logga l'errore completo server-side e sanifica i 5xx
  // (gli errori Postgres/Drizzle non incapsulati trapelerebbero nomi colonne,
  // constraint e dettagli di query). I 4xx legittimi (jwt 401, multipart 413,
  // validazioni) portano statusCode<500 e message benigni → restano invariati.
  fastify.setErrorHandler((error, request, reply) => {
    const e = error as { statusCode?: number; code?: string; message?: string }
    const status = e.statusCode ?? 500
    request.log.error({ err: error }, 'unhandled route error')
    if (status < 500) {
      return reply.code(status).send({ error: { code: e.code ?? 'BAD_REQUEST', message: e.message } })
    }
    return reply.code(500).send({ error: { code: 'INTERNAL', message: 'Errore interno' } })
  })

  // CORS: allowlist invece di reflection arbitraria. Consente solo l'appliance
  // (tako.local + IP LAN correnti) e localhost, sulle porte server/client. Senza
  // questo, qualunque sito visitato dalla vittima sulla stessa LAN poteva leggere
  // gli endpoint anonimi cross-origin con credenziali.
  const PORT_NUM = Number(process.env['PORT'] ?? 3001)
  const CLIENT_PORT = process.env['CLIENT_PORT'] ?? '3002'
  const allowedHosts = () => new Set<string>([
    'tako.local', 'localhost', '127.0.0.1', '[::1]',
    ...getLanIPv4s(),
  ])
  const allowedPorts = new Set([String(PORT_NUM), String(CLIENT_PORT)])
  function isAllowedOrigin(origin?: string): boolean {
    if (!origin) return true // same-origin / client non-browser (curl, app native) senza header Origin
    try {
      const u = new URL(origin)
      return allowedHosts().has(u.hostname) &&
             (u.port === '' || allowedPorts.has(u.port))
    } catch { return false }
  }
  // Override opzionale per reverse-proxy/dominio fisso: CORS_ORIGINS=https://a.com,https://b.com
  const corsAllowlist = (process.env['CORS_ORIGINS'] ?? '').split(',').map(s => s.trim()).filter(Boolean)
  const resolveCorsOrigin = (origin?: string): boolean => {
    if (corsAllowlist.length && origin && corsAllowlist.includes(origin)) return true
    return isAllowedOrigin(origin)
  }

// Security headers. Da quando il server serve anche la dashboard staff (stessa
// origine), la CSP deve permettere alla SPA di girare: script self + inline/eval
// (Babel-in-browser), stili inline, immagini data/blob, connessioni ws per il
// realtime. Threat model locale (LAN, stessa origine). Le risposte API restano JSON.
await fastify.register(helmet, {
  contentSecurityPolicy: {
    useDefaults: false,
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'blob:'],
      fontSrc: ["'self'", 'data:'],
      connectSrc: ["'self'", 'ws:', 'wss:', 'http:', 'https:'],
      frameAncestors: ["'none'"],
      baseUri: ["'self'"],
    },
  },
  crossOriginResourcePolicy: { policy: 'cross-origin' },
})

// CORS — Tako è un'appliance locale: il server È l'origine di tutti i client
// (dashboard same-origin, tablet/telefoni in LAN via tako.local o IP). Riflette
// l'origine con credenziali; la portata resta limitata dalla rete locale/firewall.
await fastify.register(cors, { origin: (origin, cb) => cb(null, resolveCorsOrigin(origin)), credentials: true })

await fastify.register(jwt, { secret: JWT_SECRET })
await fastify.register(cookie, { secret: JWT_SECRET })
await fastify.register(multipart, { limits: { fileSize: 10 * 1024 * 1024 } })

const UPLOADS_DIR = resolve(process.env['UPLOADS_DIR'] ?? './uploads')
mkdirSync(UPLOADS_DIR, { recursive: true })
await fastify.register(fastifyStatic, { root: UPLOADS_DIR, prefix: '/uploads/', decorateReply: false })

// Dashboard staff statica servita DALLO STESSO server. Same-origin: /api, /socket.io
// e /uploads sono sullo stesso host → niente reverse-proxy/rewrite Next. Nel bundle
// desktop STAFF_DIR punta alle risorse impacchettate; in dev al sorgente dashboard.
const currentDir = dirname(fileURLToPath(import.meta.url))
// Candidati in ordine: env esplicito → risorsa accanto al server (bundle desktop)
// → sorgente dashboard (dev). Il primo che esiste vince.
const staffCandidates = [
  process.env['STAFF_DIR'],
  resolve(currentDir, 'staff'),
  resolve(currentDir, '../../dashboard/public/staff'),
].filter((p): p is string => !!p).map((p) => resolve(p))
const STAFF_DIR = staffCandidates.find((p) => existsSync(p)) ?? staffCandidates[staffCandidates.length - 1]!
if (existsSync(STAFF_DIR)) {
  await fastify.register(fastifyStatic, { root: STAFF_DIR, prefix: '/staff/', decorateReply: false })
  // La root manda alla dashboard (la stessa UX del Next shell, ora senza Next).
  fastify.get('/', async (_req, reply) => reply.redirect('/staff/index.html'))
  console.log(`Dashboard staff servita da ${STAFF_DIR} su /staff/`)
} else {
  console.warn(`STAFF_DIR non trovato (${STAFF_DIR}); dashboard statica non servita.`)
}

// Rate limiting globale. In dev il loopback (test, dashboard locale, /health) è
// esentato: il limite per-IP serve contro abusi esterni, non contro la macchina
// stessa. In produzione resta attivo per tutti.
const rlAllowList = process.env['NODE_ENV'] === 'production' ? [] : ['127.0.0.1', '::1']
await fastify.register(rateLimit, {
  global: true,
  max: 100,          // max 100 req per finestra
  timeWindow: 60000, // 1 minuto
  allowList: rlAllowList,
  errorResponseBuilder: () => ({
    error: { code: 'RATE_LIMIT', message: 'Troppe richieste. Riprova tra un minuto.' },
  }),
})

// Health check
fastify.get('/health', async () => ({ status: 'ok', ts: new Date().toISOString() }))

// Routes
await fastify.register(authRoutes, { prefix: '/api/auth' })
// Pairing appliance↔cloud (claim + credenziale owner offline). Solo modo local.
await fastify.register(setupRoutes, { prefix: '/api/setup' })
await fastify.register(restaurantRoutes, { prefix: '/api/restaurants' })
await fastify.register(menuRoutes, { prefix: '/api/menus' })
await fastify.register(tableRoutes, { prefix: '/api/tables' })
await fastify.register(orderRoutes, { prefix: '/api/orders' })
await fastify.register(billRoutes, { prefix: '/api/bills' })
await fastify.register(inventoryRoutes, { prefix: '/api/inventory' })
await fastify.register(statsRoutes, { prefix: '/api/stats' })
await fastify.register(customerRoutes, { prefix: '/api/customer' })
await fastify.register(uploadRoutes, { prefix: '/api/uploads' })
await fastify.register(staffRoutes, { prefix: '/api/staff' })
await fastify.register(insightsRoutes, { prefix: '/api/insights' })
await fastify.register(printRoutes, { prefix: '/api/print' })
await fastify.register(systemRoutes, { prefix: '/api/system' })
await fastify.register(reservationRoutes, { prefix: '/api/reservations' })
await fastify.register(shiftRoutes, { prefix: '/api/shifts' })
await fastify.register(menuI18nRoutes, { prefix: '/api/customer' })
await fastify.register(aiOwnerRoutes, { prefix: '/api/ai/owner' })
await fastify.register(whatsappRoutes, { prefix: '/api/whatsapp' })

// Attach Socket.io to Fastify's underlying HTTP server AFTER ready()
await fastify.ready()

  io = new SocketServer(fastify.server, {
    cors: {
      origin: (origin, cb) => cb(null, resolveCorsOrigin(origin ?? undefined)),
      methods: ['GET', 'POST'],
      credentials: true,
    },
    pingTimeout: 60000,
  })
  setupSocketHandlers(io, fastify)
  // Dettatura vocale (Cmd+K): namespace dedicato + warmup del motore locale
  // in background (il primo uso non paga il cold start del modello).
  setupDictationNamespace(io)
  warmupAsr()

  // Canale WhatsApp (opt-in): parte solo se già abilitato in config o via TAKO_WHATSAPP=1.
  // In try/catch — se Baileys esplode NON deve tirare giù il server (è un extra, non il core).
  try {
    const { readFileSync } = await import('node:fs')
    const { join } = await import('node:path')
    const { homedir } = await import('node:os')
    let waEnabled = process.env['TAKO_WHATSAPP'] === '1'
    if (!waEnabled) {
      try {
        const cfgPath = join(process.env['TAKO_HOME'] ?? join(homedir(), '.tako'), 'whatsapp-config.json')
        waEnabled = JSON.parse(readFileSync(cfgPath, 'utf8'))?.enabled === true
      } catch { /* config assente → resta OFF */ }
    }
    if (waEnabled) {
      startWhatsApp().catch(err => console.error('[whatsapp] avvio automatico fallito:', err))
    }
  } catch (err) {
    console.error('[whatsapp] bootstrap saltato:', err)
  }

  try {
    await fastify.listen({ port: PORT, host: '0.0.0.0' })
    const scheme = useHttps ? 'https' : 'http'
    console.log(`Tako server running on ${scheme}://0.0.0.0:${PORT}`)
    if (useHttps) console.log(`[tls] HTTPS attivo (cert self-signed) → apri https://tako.local:${PORT}`)
    // Annuncia tako.local sulla LAN (best-effort): i dispositivi si collegano senza IP.
    startMdns()
    // Heartbeat periodica verso il cloud (best-effort, no-op se CLOUD_BASE_URL assente).
    startHeartbeatLoop(fastify)
    // Monitor connettività internet: stato online/offline → badge dashboard/PWA + fast-fail
    // delle funzioni internet. Non tocca il core (che gira comunque in locale).
    startConnectivityMonitor()
    onConnectivityChange((online) => { try { io?.emit('connectivity', { online }) } catch { /* noop */ } })
    // Diagnosi rete LAN all'avvio (best-effort): avvisa nei log se la rete è instabile/debole.
    void getNetworkHealth().then(h => { if (h.status === 'instabile' || h.status === 'debole') console.warn(`[net-health] ${h.status}: ${h.message}`) }).catch(() => { /* noop */ })
  } catch (err) {
    console.error(err)
    process.exit(1)
  }
}
