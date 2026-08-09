// F3.1 — Infrastruttura Web Push: le route di sottoscrizione.
//
// Cosa decide se questa parte è fatta bene (piano §5 F3.1):
//   1. la subscription si PERSISTE, legata alla SESSIONE (non all'utente)
//   2. ri-sottoscrivere lo stesso endpoint è un UPSERT, non una riga nuova
//   3. revocare il dispositivo cancella la subscription (CASCADE della 0018)
//   4. la disiscrizione è scoped alla sessione: nessuno spegne il telefono di un altro
//
// L'invio vero (e il 410) sta in push-dispatch.test.ts, che gira in-process.
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import postgres from 'postgres'
import { seedTestEnv, jsonHeaders, SERVER, DB_URL, type TestEnv } from './helpers.js'

let env: TestEnv
let close: () => Promise<void>
let sql: ReturnType<typeof postgres>

const authHeaders = (token: string) => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${token}` })
const bearer = (token: string) => ({ Authorization: `Bearer ${token}` })

// Una subscription "finta" ma con la FORMA giusta: è ciò che il browser passa a
// POST /subscribe (PushSubscription.toJSON()). L'host `.invalid` non risolve mai —
// è la scelta apposta: nessun test di questo repo deve poter bussare a un push
// service reale.
function fakeSub(id: string) {
  return {
    endpoint: `https://push.invalid/tako-test/${id}`,
    keys: { p256dh: 'BJxKEp_uzHM7dGWQpUE9UY7BqLIzy0lMBl4Nq0Q3jCk8fkD5nnPKX7Zc4Q9uCzWuKtVGiTk4V6f5AlL9nCiT_Bw', auth: 'k8JV6sjdbhAi9pi_hoDMPQ' },
  }
}

/** Arruola un telefono e restituisce {token, deviceId} della sessione mobile. */
async function enrollPhone(): Promise<{ token: string; deviceId: string }> {
  const codeRes = await fetch(`${SERVER}/api/auth/device/enroll-code`, {
    method: 'POST', headers: authHeaders(env.staffToken), body: '{}',
  })
  expect(codeRes.status).toBe(200)
  const { data: { code } } = await codeRes.json()
  const res = await fetch(`${SERVER}/api/auth/device/enroll`, {
    method: 'POST', headers: jsonHeaders(), body: JSON.stringify({ code, deviceName: 'iPhone di prova', platform: 'iOS' }),
  })
  expect(res.status).toBe(201)
  const { data } = await res.json()
  return { token: data.token as string, deviceId: data.deviceId as string }
}

beforeAll(async () => {
  const s = await seedTestEnv()
  env = s.env
  close = s.close
  sql = postgres(DB_URL)
})

afterAll(async () => {
  await sql`delete from push_subscriptions where endpoint like 'https://push.invalid/tako-test/%'`
  await sql.end()
  await close()
})

describe('subscription push (F3.1)', () => {
  it('la chiave VAPID è pubblica ma non anonima', async () => {
    const anon = await fetch(`${SERVER}/api/push/key`)
    expect(anon.status).toBe(401)

    const res = await fetch(`${SERVER}/api/push/key`, { headers: bearer(env.staffToken) })
    expect(res.status).toBe(200)
    const { data } = await res.json()
    // Una chiave VAPID P-256 non compressa in base64url: 65 byte → 87 caratteri.
    expect(typeof data.publicKey).toBe('string')
    expect(data.publicKey.length).toBeGreaterThanOrEqual(80)

    // È STABILE fra due chiamate: se cambiasse, ogni subscription già registrata
    // sui telefoni diventerebbe muta senza che nessuno se ne accorga.
    const again = await fetch(`${SERVER}/api/push/key`, { headers: bearer(env.staffToken) })
    expect((await again.json()).data.publicKey).toBe(data.publicKey)
  })

  it('registra la subscription legandola alla sessione, e ri-registrarla è un upsert', async () => {
    const phone = await enrollPhone()
    const sub = fakeSub(`upsert-${Date.now()}`)

    const res = await fetch(`${SERVER}/api/push/subscribe`, {
      method: 'POST', headers: authHeaders(phone.token), body: JSON.stringify(sub),
    })
    expect(res.status).toBe(201)

    const rows = await sql`select session_id, restaurant_id, fail_count from push_subscriptions where endpoint = ${sub.endpoint}`
    expect(rows.length).toBe(1)
    expect(rows[0]!['session_id']).toBe(phone.deviceId)
    expect(rows[0]!['restaurant_id']).toBe(env.restaurantId)

    // Il browser ri-sottoscrive a ogni avvio dell'app: la seconda chiamata deve
    // trovare la sua riga, non fondarne una nuova.
    const again = await fetch(`${SERVER}/api/push/subscribe`, {
      method: 'POST', headers: authHeaders(phone.token), body: JSON.stringify(sub),
    })
    expect(again.status).toBe(201)
    const after = await sql`select count(*)::int as n from push_subscriptions where endpoint = ${sub.endpoint}`
    expect(after[0]!['n']).toBe(1)
  })

  it('rifiuta una subscription malformata e una senza sessione', async () => {
    const phone = await enrollPhone()
    const bad = await fetch(`${SERVER}/api/push/subscribe`, {
      method: 'POST', headers: authHeaders(phone.token), body: JSON.stringify({ endpoint: 'non-una-url', keys: { p256dh: 'x', auth: 'y' } }),
    })
    expect(bad.status).toBe(400)

    const anon = await fetch(`${SERVER}/api/push/subscribe`, {
      method: 'POST', headers: jsonHeaders(), body: JSON.stringify(fakeSub('anon')),
    })
    expect(anon.status).toBe(401)
    const none = await sql`select count(*)::int as n from push_subscriptions where endpoint = ${fakeSub('anon').endpoint}`
    expect(none[0]!['n']).toBe(0)
  })

  it('revocare il dispositivo cancella le sue subscription (CASCADE)', async () => {
    const phone = await enrollPhone()
    const sub = fakeSub(`revoca-${Date.now()}`)
    await fetch(`${SERVER}/api/push/subscribe`, { method: 'POST', headers: authHeaders(phone.token), body: JSON.stringify(sub) })
    expect((await sql`select count(*)::int as n from push_subscriptions where endpoint = ${sub.endpoint}`)[0]!['n']).toBe(1)

    // DELETE senza corpo: solo l'header di autenticazione (trappola Fastify di F2).
    const del = await fetch(`${SERVER}/api/auth/devices/${phone.deviceId}`, { method: 'DELETE', headers: bearer(env.staffToken) })
    expect(del.status).toBe(200)

    // Nessun codice cancella questa riga: lo fa il vincolo di FK. È il motivo per
    // cui la revoca non può "dimenticarsi" delle notifiche.
    expect((await sql`select count(*)::int as n from push_subscriptions where endpoint = ${sub.endpoint}`)[0]!['n']).toBe(0)
  })

  it('la disiscrizione è scoped al proprio dispositivo', async () => {
    const a = await enrollPhone()
    const b = await enrollPhone()
    const subA = fakeSub(`scope-a-${Date.now()}`)
    const subB = fakeSub(`scope-b-${Date.now()}`)
    await fetch(`${SERVER}/api/push/subscribe`, { method: 'POST', headers: authHeaders(a.token), body: JSON.stringify(subA) })
    await fetch(`${SERVER}/api/push/subscribe`, { method: 'POST', headers: authHeaders(b.token), body: JSON.stringify(subB) })

    // A prova a spegnere l'endpoint di B conoscendolo: non deve succedere niente.
    const cross = await fetch(`${SERVER}/api/push/subscribe?endpoint=${encodeURIComponent(subB.endpoint)}`, {
      method: 'DELETE', headers: bearer(a.token),
    })
    expect(cross.status).toBe(200)
    expect((await cross.json()).data.removed).toBe(0)
    expect((await sql`select count(*)::int as n from push_subscriptions where endpoint = ${subB.endpoint}`)[0]!['n']).toBe(1)

    // Senza `endpoint` si spengono tutte le proprie: è il pulsante "basta notifiche
    // su questo telefono".
    const own = await fetch(`${SERVER}/api/push/subscribe`, { method: 'DELETE', headers: bearer(a.token) })
    expect((await own.json()).data.removed).toBe(1)
    expect((await sql`select count(*)::int as n from push_subscriptions where endpoint = ${subA.endpoint}`)[0]!['n']).toBe(0)

    // B pulisce la sua: il caso successivo verifica anche l'esito "nessun destinatario",
    // che sarebbe falsato da una subscription lasciata in giro da questo test.
    await fetch(`${SERVER}/api/push/subscribe`, { method: 'DELETE', headers: bearer(b.token) })
  })

  it('POST /test non lancia mai: né con un endpoint irraggiungibile, né senza destinatari', async () => {
    const phone = await enrollPhone()
    const sub = fakeSub(`test-${Date.now()}`)
    await fetch(`${SERVER}/api/push/subscribe`, { method: 'POST', headers: authHeaders(phone.token), body: JSON.stringify(sub) })

    // L'host non esiste: l'invio fallisce davvero, e deve tornare come NUMERO, non
    // come 500. È il cuore dello Stop di F3.1 — la push non rompe mai chi la genera.
    const res = await fetch(`${SERVER}/api/push/test`, { method: 'POST', headers: bearer(env.staffToken) })
    expect(res.status).toBe(200)
    const { data } = await res.json()
    expect(data.sent).toBe(0)
    // Se l'appliance non ha internet il fast-fail scatta prima: entrambi gli esiti
    // sono corretti, e nessuno dei due è un'eccezione.
    if (data.skipped === 'offline') expect(data.failed).toBe(0)
    else expect(data.failed + data.removed).toBeGreaterThanOrEqual(1)

    // Senza destinatari: "saltato", che è un esito legittimo e non un errore.
    await sql`delete from push_subscriptions where restaurant_id = ${env.restaurantId}`
    const empty = await fetch(`${SERVER}/api/push/test`, { method: 'POST', headers: bearer(env.staffToken) })
    expect(empty.status).toBe(200)
    expect(['no-subscriptions', 'offline', 'no-vapid']).toContain((await empty.json()).data.skipped)
  })
})
