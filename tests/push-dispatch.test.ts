// F3.1 — `pushDispatch()`: cosa succede quando l'invio va male.
//
// Questo file gira IN-PROCESS (importa `apps/server/src/lib/push.ts` e parla con lo
// stesso Postgres del server): è l'unico modo di osservare l'esito di un invio senza
// bussare a un push service vero. La rete e il verdetto su internet sono iniettati
// (`PushDeps`); tutto il resto — query, filtri, cancellazioni — è il codice di
// produzione, non un finto.
//
// I quattro casi che decidono lo Stop di F3.1/F3.2:
//   1. endpoint morto (410)   → riga rimossa, NESSUNA eccezione propagata
//   2. errore transitorio     → riga conservata, fail_count +1
//   3. appliance offline      → ZERO invii (fast-fail, nemmeno una query)
//   4. sessione revocata/scaduta → ZERO invii verso quel telefono
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import postgres from 'postgres'
import { randomUUID } from 'node:crypto'
import { DB_URL } from './helpers.js'

// TAKO_HOME isolato: la generazione delle chiavi VAPID scrive un file, e non deve
// toccare il ~/.tako dell'appliance vera che gira su questa macchina.
process.env['TAKO_HOME'] = process.env['TAKO_HOME'] ?? '/tmp/tako-test-home'
process.env['DATABASE_URL'] = DB_URL

type PushModule = typeof import('../apps/server/src/lib/push.js')
let push: PushModule
let sql: ReturnType<typeof postgres>

let restaurantId: string
let userId: string
let sessionId: string
let expiredSessionId: string

const KEYS = { p256dh: 'BJxKEp_uzHM7dGWQpUE9UY7BqLIzy0lMBl4Nq0Q3jCk8fkD5nnPKX7Zc4Q9uCzWuKtVGiTk4V6f5AlL9nCiT_Bw', auth: 'k8JV6sjdbhAi9pi_hoDMPQ' }
const NOTIF = { title: 'Test', body: 'corpo', url: '/owner/#ordini', tag: 'order', kind: 'order' as const }

/** Sempre online: il fast-fail su internet si verifica a parte, non ovunque. */
const online = () => true

async function addSub(session: string, endpoint: string) {
  await sql`
    insert into push_subscriptions (restaurant_id, session_id, endpoint, p256dh, auth)
    values (${restaurantId}, ${session}, ${endpoint}, ${KEYS.p256dh}, ${KEYS.auth})`
}

beforeAll(async () => {
  sql = postgres(DB_URL)
  const slug = `tako-test-push-${randomUUID().slice(0, 8)}`
  const [r] = await sql`insert into restaurants (name, slug, plan, primary_color) values ('Tako Push', ${slug}, 'pro', '#ED7159') returning id`
  restaurantId = r!['id'] as string
  const [u] = await sql`insert into users (restaurant_id, name, email, role) values (${restaurantId}, 'Owner', ${slug + '@test.local'}, 'owner') returning id`
  userId = u!['id'] as string
  const [s] = await sql`
    insert into sessions (user_id, token, expires_at, kind, device_name)
    values (${userId}, ${'test_push_' + randomUUID().replace(/-/g, '')}, now() + interval '1 day', 'mobile', 'iPhone') returning id`
  sessionId = s!['id'] as string
  const [e] = await sql`
    insert into sessions (user_id, token, expires_at, kind, device_name)
    values (${userId}, ${'test_push_old_' + randomUUID().replace(/-/g, '')}, now() - interval '1 day', 'mobile', 'iPhone scaduto') returning id`
  expiredSessionId = e!['id'] as string

  push = await import('../apps/server/src/lib/push.js')
})

afterAll(async () => {
  await sql`delete from push_subscriptions where restaurant_id = ${restaurantId}`
  await sql`delete from sessions where user_id = ${userId}`
  await sql`delete from restaurants where id = ${restaurantId}`
  await sql.end()
})

describe('pushDispatch: gli errori non escono mai da qui (F3.1)', () => {
  it('un endpoint morto (410) viene rimosso, senza eccezioni', async () => {
    const endpoint = `https://push.invalid/dead-${randomUUID()}`
    await addSub(sessionId, endpoint)

    // Il push service dice "questo indirizzo non esiste più": è l'UNICA risposta che
    // autorizza a cancellare. Nessun try/catch nel test: se `pushDispatch` lasciasse
    // sfuggire l'eccezione, il test fallirebbe qui — che è esattamente il punto.
    const result = await push.pushDispatch(restaurantId, NOTIF, {
      online,
      send: async () => { throw Object.assign(new Error('Gone'), { statusCode: 410 }) },
    })

    expect(result.removed).toBe(1)
    expect(result.sent).toBe(0)
    const rows = await sql`select count(*)::int as n from push_subscriptions where endpoint = ${endpoint}`
    expect(rows[0]!['n']).toBe(0)
  })

  it('un errore transitorio (500) conserva la riga e incrementa fail_count', async () => {
    const endpoint = `https://push.invalid/flaky-${randomUUID()}`
    await addSub(sessionId, endpoint)

    const result = await push.pushDispatch(restaurantId, NOTIF, {
      online,
      send: async () => { throw Object.assign(new Error('Internal'), { statusCode: 500 }) },
    })

    expect(result.failed).toBe(1)
    expect(result.removed).toBe(0)
    // Un push service che singhiozza non deve costare al ristoratore le notifiche:
    // la riga resta, e solo dieci fallimenti CONSECUTIVI la cancellano.
    const rows = await sql`select fail_count from push_subscriptions where endpoint = ${endpoint}`
    expect(rows.length).toBe(1)
    expect(rows[0]!['fail_count']).toBe(1)

    // Un invio riuscito azzera il contatore: "consecutivi" deve voler dire consecutivi.
    await push.pushDispatch(restaurantId, NOTIF, { online, send: async () => {} })
    const after = await sql`select fail_count, last_success_at from push_subscriptions where endpoint = ${endpoint}`
    expect(after[0]!['fail_count']).toBe(0)
    expect(after[0]!['last_success_at']).not.toBeNull()
    await sql`delete from push_subscriptions where endpoint = ${endpoint}`
  })

  it('senza internet non parte NIENTE (fast-fail)', async () => {
    const endpoint = `https://push.invalid/offline-${randomUUID()}`
    await addSub(sessionId, endpoint)

    let calls = 0
    const result = await push.pushDispatch(restaurantId, NOTIF, {
      online: () => false,
      send: async () => { calls++ },
    })

    expect(calls).toBe(0)
    expect(result.skipped).toBe('offline')
    expect(result.sent).toBe(0)
    await sql`delete from push_subscriptions where endpoint = ${endpoint}`
  })

  it('una sessione revocata o scaduta non riceve niente', async () => {
    const revocata = `https://push.invalid/revoked-${randomUUID()}`
    const scaduta = `https://push.invalid/expired-${randomUUID()}`
    const viva = `https://push.invalid/alive-${randomUUID()}`
    await addSub(sessionId, revocata)
    await addSub(expiredSessionId, scaduta)
    await addSub(sessionId, viva)

    // Revoca = la riga di `sessions` sparisce; la subscription la segue per CASCADE.
    const [tmp] = await sql`
      insert into sessions (user_id, token, expires_at, kind) values (${userId}, ${'tmp_' + randomUUID().replace(/-/g, '')}, now() + interval '1 day', 'mobile') returning id`
    await sql`update push_subscriptions set session_id = ${tmp!['id']} where endpoint = ${revocata}`
    await sql`delete from sessions where id = ${tmp!['id']}`

    const hit: string[] = []
    const result = await push.pushDispatch(restaurantId, NOTIF, {
      online,
      send: async (t) => { hit.push(t.endpoint) },
    })

    expect(hit).toEqual([viva])
    expect(result.sent).toBe(1)
    await sql`delete from push_subscriptions where restaurant_id = ${restaurantId}`
  })

  it('la chiave VAPID è stabile fra due letture', async () => {
    const a = push.getVapidPublicKey()
    const b = push.getVapidPublicKey()
    expect(a).toBeTruthy()
    expect(a).toBe(b)
  })
})
