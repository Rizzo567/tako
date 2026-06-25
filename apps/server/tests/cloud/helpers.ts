// Helper per i test del CONTROL-PLANE cloud (TAKO_MODE=cloud) — FASE 5c.
//
// Strategia (vedi handoff): l'ambiente non ha un Postgres esterno né Redis, ma
// `@tako/db/embedded` (embedded-postgres) funziona. Quindi avviamo un Postgres
// EFFIMERO per-file di test, applichiamo SOLO la migrazione cloud, e montiamo le
// route cloud reali (cloudAuthRoutes/cloudOAuthRoutes/cloudPairRoutes) su un'istanza
// Fastify usata con `inject` (nessun socket TCP, nessun listen).
//
// IMPORTANTE: le env cloud (TAKO_MODE, CLOUD_DATABASE_URL, TOKEN_PEPPER, SESSION_SECRET,
// SITE_BASE_URL, ALLOWED_ORIGINS, COOKIE_MODE) vanno impostate PRIMA di costruire l'app,
// perché i moduli cloud le leggono a runtime ad ogni chiamata. Il client `cloudDb` è lazy
// (Proxy) e legge CLOUD_DATABASE_URL alla prima query: la impostiamo prima di qualunque
// richiesta. Ogni FILE di test gira in un fork isolato (vitest pool:'forks',
// fileParallelism:false), quindi env e singleton lazy non si contaminano tra file.
import Fastify, { type FastifyInstance } from 'fastify'
import cors from '@fastify/cors'
import cookie from '@fastify/cookie'
import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'
import EmbeddedPostgres from 'embedded-postgres'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

// __dirname = apps/server/tests/cloud → repo root = ../../../..
const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..')
const CLOUD_MIGRATIONS = join(REPO_ROOT, 'packages', 'db', 'src', 'migrations-cloud')

// Porta effimera per evitare collisioni se più file girassero (qui fileParallelism:false).
function randomPort(): number {
  return 55000 + Math.floor(Math.random() * 5000)
}

export interface CloudTestCtx {
  app: FastifyInstance
  sql: ReturnType<typeof postgres>
  /** Cattura dei token email dal transport mock (HTML loggato su console). */
  emails: CapturedEmail[]
  /** Estrae l'ultimo token verify/reset catturato per un dato indirizzo. */
  lastTokenFor(to: 'verify' | 'reset', email?: string): string | undefined
  close(): Promise<void>
}

export interface CapturedEmail {
  raw: string
}

export interface CloudTestOptions {
  cookieMode?: 'samesite' | 'crosssite'
  allowedOrigins?: string
  /** Provider OAuth fittizi da abilitare (montano le route /google|/github). */
  oauth?: { google?: boolean; github?: boolean }
}

/**
 * Imposta le env cloud necessarie. Idempotente; va chiamata prima di importare/usare
 * i moduli cloud (i moduli leggono process.env a runtime).
 */
export function setCloudEnv(opts: CloudTestOptions = {}): void {
  process.env['TAKO_MODE'] = 'cloud'
  process.env['TOKEN_PEPPER'] = process.env['TOKEN_PEPPER'] ?? 'test-pepper-0123456789abcdef'
  process.env['SESSION_SECRET'] = process.env['SESSION_SECRET'] ?? 'test-session-secret-0123456789abcdef'
  process.env['SITE_BASE_URL'] = process.env['SITE_BASE_URL'] ?? 'https://tako.app'
  process.env['ALLOWED_ORIGINS'] = opts.allowedOrigins ?? 'https://tako.app,https://www.tako.app'
  process.env['COOKIE_MODE'] = opts.cookieMode ?? 'samesite'
  process.env['EMAIL_TRANSPORT'] = 'mock'
  if (opts.oauth?.google) {
    process.env['GOOGLE_CLIENT_ID'] = 'test-google-id'
    process.env['GOOGLE_CLIENT_SECRET'] = 'test-google-secret'
    process.env['OAUTH_BASE_URL'] = 'https://api.tako.app'
  }
  if (opts.oauth?.github) {
    process.env['GITHUB_CLIENT_ID'] = 'test-github-id'
    process.env['GITHUB_CLIENT_SECRET'] = 'test-github-secret'
    process.env['OAUTH_BASE_URL'] = 'https://api.tako.app'
  }
}

let _pg: InstanceType<typeof EmbeddedPostgres> | null = null
let _pgDir: string | null = null

/** Avvia un Postgres effimero, applica la migrazione cloud, imposta CLOUD_DATABASE_URL. */
async function startEphemeralCloudDb(): Promise<ReturnType<typeof postgres>> {
  const dir = mkdtempSync(join(tmpdir(), 'tako-cloud-pg-'))
  const port = randomPort()
  const pg = new EmbeddedPostgres({ databaseDir: dir, user: 'tako', password: 'tako', port, persistent: false })
  await pg.initialise()
  await pg.start()
  await pg.createDatabase('takocloud')
  _pg = pg
  _pgDir = dir
  const url = `postgresql://tako:tako@127.0.0.1:${port}/takocloud`
  process.env['CLOUD_DATABASE_URL'] = url
  const migClient = postgres(url, { max: 1 })
  try {
    await migrate(drizzle(migClient), { migrationsFolder: CLOUD_MIGRATIONS })
  } finally {
    await migClient.end()
  }
  return postgres(url)
}

/**
 * Costruisce un'app Fastify che monta le route cloud reali, in modo identico (per quanto
 * rilevante ai test) a startCloudServer(): cookie firmati, CORS allowlist esatta, CSRF/
 * SameSite governati da COOKIE_MODE. NON registriamo rate-limit (richiederebbe Redis) né
 * helmet (irrilevante ai flussi funzionali): la loro assenza non altera i comportamenti
 * testati. NON chiama listen: i test usano app.inject.
 */
async function buildCloudApp(opts: CloudTestOptions): Promise<FastifyInstance> {
  // Import dinamico DOPO setCloudEnv + CLOUD_DATABASE_URL impostata.
  const { cloudAuthRoutes } = await import('../../src/routes/cloud/auth.ts')
  const { cloudOAuthRoutes } = await import('../../src/routes/cloud/oauth.ts')
  const { cloudPairRoutes } = await import('../../src/routes/cloud/pair.ts')
  const { allowedOrigins } = await import('../../src/cloud/config.ts')

  const app = Fastify({ logger: false })

  const origins = allowedOrigins()
  await app.register(cors, {
    origin: (origin, cb) => {
      if (!origin) return cb(null, true)
      if (origins.includes(origin)) return cb(null, true)
      return cb(null, false)
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'X-Tako-CSRF'],
  })
  await app.register(cookie, { secret: process.env['SESSION_SECRET']! })

  await app.register(cloudAuthRoutes, { prefix: '/api/auth' })
  // Wrapper che cattura l'istanza incapsulata su cui @fastify/oauth2 decora googleOAuth2/
  // githubOAuth2 (fastify-plugin espone le decorazioni alla scope passata). Salviamo il
  // riferimento per poter mockare il SOLO confine esterno (token exchange) nei test OAuth.
  await app.register(async (scope) => {
    _oauthScope = scope
    await cloudOAuthRoutes(scope)
  }, { prefix: '/api/auth' })
  await app.register(cloudPairRoutes, { prefix: '/api/pair' })
  await app.ready()
  return app
}

let _oauthScope: FastifyInstance | null = null
/** Istanza incapsulata che porta le decorazioni googleOAuth2/githubOAuth2 (per i test OAuth). */
export function oauthScope(): FastifyInstance {
  if (!_oauthScope) throw new Error('oauth scope non disponibile (app non costruita o OAuth non montato)')
  return _oauthScope
}

/** Avvia DB effimero + app cloud + cattura email. Da chiamare in beforeAll. */
export async function setupCloud(opts: CloudTestOptions = {}): Promise<CloudTestCtx> {
  setCloudEnv(opts)
  const sql = await startEphemeralCloudDb()

  // Cattura email: il transport mock di email.ts logga l'HTML su console.log. Lo
  // intercettiamo per estrarre i link verify/reset (con il token in chiaro). È il
  // meccanismo "mock" previsto dal contratto/handoff per recuperare il token.
  const emails: CapturedEmail[] = []
  const originalLog = console.log
  console.log = (...args: unknown[]) => {
    const text = args.map((a) => (typeof a === 'string' ? a : String(a))).join(' ')
    if (text.includes('[EMAIL MOCK]')) emails.push({ raw: text })
  }

  const app = await buildCloudApp(opts)

  function lastTokenFor(kind: 'verify' | 'reset'): string | undefined {
    const path = kind === 'verify' ? 'verify-email' : 'reset-password'
    // Cerca a ritroso l'ultima email che contiene il link del tipo richiesto.
    for (let i = emails.length - 1; i >= 0; i--) {
      const m = emails[i]!.raw.match(new RegExp(`${path}\\?token=([A-Za-z0-9_-]+)`))
      if (m?.[1]) return m[1]
    }
    return undefined
  }

  return {
    app,
    sql,
    emails,
    lastTokenFor,
    async close() {
      console.log = originalLog
      try { await app.close() } catch { /* ignore */ }
      try { await sql.end() } catch { /* ignore */ }
      if (_pg) { try { await _pg.stop() } catch { /* ignore */ } _pg = null }
      if (_pgDir) { try { rmSync(_pgDir, { recursive: true, force: true }) } catch { /* ignore */ } _pgDir = null }
    },
  }
}

// ─── Helper di richiesta ─────────────────────────────────────────────────────

/** Estrae il valore di un cookie da un header Set-Cookie (array). */
export function cookieFromSetCookie(setCookie: string[] | undefined, name: string): string | undefined {
  if (!setCookie) return undefined
  for (const sc of setCookie) {
    const m = sc.match(new RegExp(`^${name}=([^;]+)`))
    if (m) return m[1]
  }
  return undefined
}

/** Header Cookie da una mappa nome→valore. */
export function cookieHeader(pairs: Record<string, string>): string {
  return Object.entries(pairs).map(([k, v]) => `${k}=${v}`).join('; ')
}
