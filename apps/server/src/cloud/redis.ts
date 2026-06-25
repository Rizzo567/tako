// Client Redis CONDIVISO del control-plane cloud + helper anti-abuso (lockout/quota/nonce).
//
// Perché qui (security-review FASE 5e):
//   Diversi freni anti-abuso (per-code lockout del claim, quota anti mail-bombing,
//   anti-replay nonce dell'heartbeat) erano in-memory PER-ISTANZA: con più repliche del
//   control-plane dietro il load balancer non sono condivisi → un attaccante che ruota le
//   repliche aggira il limite. Li spostiamo su Redis (lo STESSO REDIS_URL già usato dal
//   rate-limit). FALLBACK in-memory quando REDIS_URL non è impostata (dev/test e single
//   istanza): il comportamento osservabile resta identico ai test esistenti (che non usano
//   Redis), solo non è condiviso tra repliche.
//
// Singleton lazy: il client si crea alla prima richiesta che lo necessita, leggendo
// REDIS_URL a runtime (coerente con gli altri moduli cloud). Così il test harness, che NON
// imposta REDIS_URL e costruisce l'app per conto suo, ottiene sempre il ramo in-memory.
import { Redis } from 'ioredis'

let _client: Redis | null | undefined

/**
 * Ritorna il client Redis condiviso, o `null` se REDIS_URL non è impostata (→ fallback
 * in-memory). Riusa lo stesso URL del rate-limit. Non lancia: se la connessione fallisce a
 * runtime i singoli helper degradano al ramo in-memory.
 */
export function getRedis(): Redis | null {
  if (_client !== undefined) return _client
  const url = process.env['REDIS_URL']
  if (!url) {
    _client = null
    return null
  }
  const client = new Redis(url, { connectTimeout: 5000, maxRetriesPerRequest: 1, lazyConnect: false })
  // Un errore di connessione non deve crashare il processo: lo logghiamo e gli helper
  // cadranno sul ramo in-memory finché Redis non torna disponibile.
  client.on('error', () => { /* swallow: gli helper gestiscono il fallback */ })
  _client = client
  return client
}

/**
 * Permette al server di INIETTARE il client Redis già costruito in server.ts (così non se ne
 * apre un secondo). Idempotente. Passare `null` forza esplicitamente il ramo in-memory.
 */
export function setRedis(client: Redis | null): void {
  _client = client
}

/** Solo per i test: resetta il singleton per non contaminare i file di test successivi. */
export function __resetRedisForTests(): void {
  _client = undefined
}

// ─── Helper: contatore con scadenza (lockout/quota) ──────────────────────────────
// INCR atomico + EXPIRE alla prima occorrenza. Ritorna il conteggio corrente, o null se
// Redis non disponibile (il chiamante usa il fallback in-memory).
export async function incrWithTtl(key: string, ttlSeconds: number): Promise<number | null> {
  const redis = getRedis()
  if (!redis) return null
  try {
    const count = await redis.incr(key)
    if (count === 1) await redis.expire(key, ttlSeconds)
    return count
  } catch {
    return null
  }
}

/** Legge il contatore corrente (0 se assente). null se Redis non disponibile. */
export async function getCount(key: string): Promise<number | null> {
  const redis = getRedis()
  if (!redis) return null
  try {
    const v = await redis.get(key)
    return v === null ? 0 : Number(v)
  } catch {
    return null
  }
}

/** Cancella una chiave (es. azzeramento lockout dopo successo). No-op senza Redis. */
export async function del(key: string): Promise<void> {
  const redis = getRedis()
  if (!redis) return
  try { await redis.del(key) } catch { /* best-effort */ }
}

/**
 * Anti-replay basato su nonce/timestamp monotono per chiave (es. heartbeat per-appliance).
 * Memorizza l'ultimo `ts` accettato con un TTL; rifiuta un `ts` <= all'ultimo visto.
 * Ritorna:
 *   - 'ok'        → ts accettato e registrato;
 *   - 'replay'    → ts già visto o non monotono → rifiuta;
 *   - 'no-redis'  → Redis non disponibile → il chiamante applica la sola finestra temporale.
 * Implementato con uno script Lua per atomicità (read-compare-set).
 */
const MONOTONIC_LUA = `
local last = redis.call('GET', KEYS[1])
if last and tonumber(ARGV[1]) <= tonumber(last) then
  return 0
end
redis.call('SET', KEYS[1], ARGV[1], 'EX', tonumber(ARGV[2]))
return 1
`
export async function checkMonotonicTs(
  key: string,
  ts: number,
  ttlSeconds: number,
): Promise<'ok' | 'replay' | 'no-redis'> {
  const redis = getRedis()
  if (!redis) return 'no-redis'
  try {
    const res = (await redis.eval(MONOTONIC_LUA, 1, key, String(ts), String(ttlSeconds))) as number
    return res === 1 ? 'ok' : 'replay'
  } catch {
    // Errore Redis a runtime: degrada alla sola finestra temporale (non bloccare l'appliance).
    return 'no-redis'
  }
}
