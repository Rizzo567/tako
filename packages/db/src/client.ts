import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { readFileSync } from 'node:fs'
import * as schema from './schema/index.js'

// Client Drizzle LAZY: la connessione (e quindi la lettura di DATABASE_URL) avviene
// alla PRIMA query, non all'import. Così i test possono impostare DATABASE_URL (DB
// isolati) dopo aver importato le route.
type Drizzle = ReturnType<typeof drizzle<typeof schema>>

/** Explicit Edge settings; Node defaults remain unchanged. No connection is opened here. */
export function databaseOptions(env: NodeJS.ProcessEnv = process.env, certificate: (path: string) => string = path => readFileSync(path, 'utf8')): {max?:number;prepare?:boolean;idle_timeout?:number;max_lifetime?:number;connect_timeout?:number;ssl?:{ca?:string;rejectUnauthorized:boolean}} {
  const edge = env['TAKO_EXECUTION_RUNTIME'] === 'edge'
  const inline = env['DATABASE_CA_CERT']?.trim()
  const caPath = env['DATABASE_CA_CERT_PATH']
  if (edge && !env['DATABASE_URL']) throw new Error('Edge database requires DATABASE_URL')
  if (edge && !inline && caPath) throw new Error('Edge database requires inline DATABASE_CA_CERT; local CA paths are unavailable')
  const ca = inline || (caPath ? certificate(caPath) : undefined)
  if (edge) return { max: 1, prepare: false, idle_timeout: 5, max_lifetime: 60, connect_timeout: 10, ssl: { rejectUnauthorized: true, ...(ca ? { ca } : {}) } }
  return ca ? { ssl: { ca, rejectUnauthorized: true } } : {}
}

let _db: Drizzle | null = null
function real(): Drizzle {
  if (!_db) {
    const connectionString = process.env['DATABASE_URL'] ?? 'postgresql://tako:tako@localhost:5432/takodb'
    const connection = postgres(connectionString, databaseOptions())
    _db = drizzle(connection, { schema })
  }
  return _db
}

// Proxy trasparente: ogni accesso/chiamata inizializza il client al primo uso.
export const db: Drizzle = new Proxy({} as Drizzle, {
  get(_t, prop) {
    const r = real() as unknown as Record<string | symbol, unknown>
    const v = r[prop]
    return typeof v === 'function' ? (v as (...a: unknown[]) => unknown).bind(r) : v
  },
})

export type DB = typeof db
