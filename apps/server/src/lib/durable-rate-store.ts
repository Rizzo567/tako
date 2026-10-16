import { createHash } from 'node:crypto'
import { db } from '@tako/db'
import { sql } from 'drizzle-orm'
import { DurableRateCounter, type CounterExecutor, type CounterResult } from './durable-rate-counter.js'

type StoreOptions = { continueExceeding?: boolean; exponentialBackoff?: boolean; groupId?: string; routeInfo?: { method?: string | string[]; url?: string } }
export const postgresCounterExecutor: CounterExecutor = async (namespace, keyHash, windowMs) => {
  const rows = await db.execute(sql`select current, ttl, iteration_start_ms from public.consume_edge_rate_counter(${namespace}, ${keyHash}, ${windowMs})`)
  const row = rows[0]
  return { current: Number(row?.current), ttl: Number(row?.ttl), iterationStartMs: Number(row?.iteration_start_ms) }
}

/** Fastify constructs this class and child() supplies routeInfo. No per-isolate state. */
export function durableStoreConstructor(execute: CounterExecutor, secret: string) {
  return class DurableStore {
    private counter: DurableRateCounter
    constructor(options: StoreOptions = {}) {
      if (options.continueExceeding || options.exponentialBackoff) throw new Error('Durable rate store supports fixed windows only')
      const route = options.groupId ? `group:${options.groupId}` : options.routeInfo?.url ? `${JSON.stringify(options.routeInfo.method)}:${options.routeInfo.url}` : 'global'
      const namespace = `fastify:v1:${createHash('sha256').update(route).digest('hex')}`
      this.counter = new DurableRateCounter(execute, secret, namespace)
    }
    incr(key: string, callback: (error: Error | null, result?: CounterResult) => void, windowMs = 60000) {
      this.counter.consume(String(key), windowMs).then(result => callback(null, result), error => callback(error))
    }
    child(options: unknown) { return new DurableStore(options as StoreOptions) }
  }
}

export function optionalDurableStore(env: NodeJS.ProcessEnv = process.env) {
  if (env['TAKO_DURABLE_RATE_LIMIT'] !== '1') return undefined
  if (env['TAKO_EXECUTION_RUNTIME'] !== 'edge') throw new Error('Durable rate store opt-in requires explicit Edge runtime')
  if (!env['DATABASE_URL']) throw new Error('Durable rate store requires DATABASE_URL')
  const secret = env['TAKO_RATE_LIMIT_SECRET'] ?? ''
  // Validate immediately even before the plugin constructor gets instantiated.
  new DurableRateCounter(postgresCounterExecutor, secret, 'startup')
  return durableStoreConstructor(postgresCounterExecutor, secret)
}
