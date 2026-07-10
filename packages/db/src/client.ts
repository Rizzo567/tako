import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema/index.js'

// Client Drizzle LAZY: la connessione (e quindi la lettura di DATABASE_URL) avviene
// alla PRIMA query, non all'import. Così il server può importare le route (che
// importano questo modulo) prima di aver avviato il Postgres embedded: DATABASE_URL
// viene impostato da maybeStartEmbeddedDb() e letto solo quando serve davvero.
type Drizzle = ReturnType<typeof drizzle<typeof schema>>

let _db: Drizzle | null = null
function real(): Drizzle {
  if (!_db) {
    const connectionString = process.env['DATABASE_URL'] ?? 'postgresql://tako:tako@localhost:5432/takodb'
    _db = drizzle(postgres(connectionString), { schema })
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
