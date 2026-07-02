import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { randomUUID } from 'node:crypto'
import { seedTestEnv, jsonHeaders, SERVER, type TestEnv } from './helpers'

let env: TestEnv        // ristorante A
let envB: TestEnv       // ristorante B (per lo scoping tenant)
let closeA: () => Promise<void>
let closeB: () => Promise<void>

beforeAll(async () => {
  const a = await seedTestEnv(); env = a.env; closeA = a.close
  const b = await seedTestEnv(); envB = b.env; closeB = b.close
})
afterAll(async () => { await closeA?.(); await closeB?.() })

const staff = () => jsonHeaders(`tako_session=${env.staffToken}`)
const staffB = () => jsonHeaders(`tako_session=${envB.staffToken}`)

// costruisce un istante ISO in un giorno/ora locale
const at = (day: string, hhmm: string) => new Date(`${day}T${hhmm}:00`).toISOString()

async function create(headers: Record<string, string>, body: any) {
  return fetch(`${SERVER}/api/reservations`, { method: 'POST', headers, body: JSON.stringify(body) })
}
const base = (tableId: string, startsAt: string, durationMin = 90) => ({
  customerName: 'Mario Rossi', customerPhone: '+39 333 1234567', partySize: 4, startsAt, durationMin, tableId,
})

describe('Prenotazioni: anti-overbooking', () => {
  it('due prenotazioni sovrapposte sullo stesso tavolo → 409', async () => {
    const day = '2027-01-10'
    const r1 = await create(staff(), base(env.tableId, at(day, '20:00'), 90)) // 20:00–21:30
    expect(r1.status).toBe(201)
    const r2 = await create(staff(), base(env.tableId, at(day, '21:00'), 60)) // 21:00–22:00 → overlap
    expect(r2.status).toBe(409)
    expect((await r2.json()).error.code).toBe('RESERVATION_OVERLAP')
  })

  it('orario adiacente (bordo esatto) sullo stesso tavolo → 201', async () => {
    const day = '2027-01-11'
    const r1 = await create(staff(), base(env.tableId, at(day, '20:00'), 90)) // 20:00–21:30
    expect(r1.status).toBe(201)
    const r2 = await create(staff(), base(env.tableId, at(day, '21:30'), 60)) // inizia quando l'altra finisce
    expect(r2.status).toBe(201)
  })

  it('una prenotazione cancellata non blocca la fascia oraria → 201', async () => {
    const day = '2027-01-12'
    const r1 = await create(staff(), base(env.tableId, at(day, '20:00'), 90))
    const id1 = (await r1.json()).data.id
    // sovrapposta → 409 finché r1 è attiva
    const r2 = await create(staff(), base(env.tableId, at(day, '20:30'), 60))
    expect(r2.status).toBe(409)
    // cancella r1
    const c = await fetch(`${SERVER}/api/reservations/${id1}/status`, { method: 'PATCH', headers: staff(), body: JSON.stringify({ status: 'cancelled' }) })
    expect(c.status).toBe(200)
    // ora la stessa fascia è libera → 201
    const r3 = await create(staff(), base(env.tableId, at(day, '20:30'), 60))
    expect(r3.status).toBe(201)
  })

  it('prenotazione senza tavolo non è soggetta a overbooking → 201', async () => {
    const day = '2027-01-13'
    const p = { customerName: 'Senza Tavolo', customerPhone: '333', partySize: 2, startsAt: at(day, '20:00') }
    const r1 = await fetch(`${SERVER}/api/reservations`, { method: 'POST', headers: staff(), body: JSON.stringify(p) })
    const r2 = await fetch(`${SERVER}/api/reservations`, { method: 'POST', headers: staff(), body: JSON.stringify(p) })
    expect(r1.status).toBe(201)
    expect(r2.status).toBe(201)
  })

  it('assegnare un tavolo già occupato in quella fascia → 409', async () => {
    const day = '2027-01-14'
    const r1 = await create(staff(), base(env.tableId, at(day, '19:00'), 90))
    expect(r1.status).toBe(201)
    // prenotazione senza tavolo, stessa fascia
    const r2 = await fetch(`${SERVER}/api/reservations`, { method: 'POST', headers: staff(), body: JSON.stringify({ customerName: 'X', customerPhone: '1', partySize: 2, startsAt: at(day, '19:30'), durationMin: 60 }) })
    const id2 = (await r2.json()).data.id
    // assegnarle lo stesso tavolo → conflitto
    const assign = await fetch(`${SERVER}/api/reservations/${id2}/table`, { method: 'PATCH', headers: staff(), body: JSON.stringify({ tableId: env.tableId }) })
    expect(assign.status).toBe(409)
    expect((await assign.json()).error.code).toBe('RESERVATION_OVERLAP')
  })
})

describe('Prenotazioni: scoping tenant', () => {
  it('la lista mostra solo le prenotazioni del proprio ristorante', async () => {
    const day = '2027-02-01'
    const r = await create(staff(), base(env.tableId, at(day, '20:00'), 90))
    expect(r.status).toBe(201)
    // il ristorante B non vede nulla in quel giorno
    const listB = await (await fetch(`${SERVER}/api/reservations?date=${day}`, { headers: staffB() })).json()
    expect(listB.data.length).toBe(0)
    // il ristorante A vede la sua
    const listA = await (await fetch(`${SERVER}/api/reservations?date=${day}`, { headers: staff() })).json()
    expect(listA.data.some((x: any) => x.customerName === 'Mario Rossi')).toBe(true)
  })

  it('un altro ristorante non può cambiare stato di una prenotazione altrui → 404', async () => {
    const day = '2027-02-02'
    const r = await create(staff(), base(env.tableId, at(day, '20:00'), 90))
    const id = (await r.json()).data.id
    const bad = await fetch(`${SERVER}/api/reservations/${id}/status`, { method: 'PATCH', headers: staffB(), body: JSON.stringify({ status: 'confirmed' }) })
    expect(bad.status).toBe(404)
    // e non può nemmeno assegnare il proprio tavolo alla prenotazione altrui
    const badAssign = await fetch(`${SERVER}/api/reservations/${id}/table`, { method: 'PATCH', headers: staffB(), body: JSON.stringify({ tableId: envB.tableId }) })
    expect(badAssign.status).toBe(404)
  })

  it('non può assegnare un tavolo di un altro ristorante → 404', async () => {
    const day = '2027-02-03'
    const r = await create(staff(), base(env.tableId, at(day, '20:00'), 90))
    const id = (await r.json()).data.id
    // il tavolo di B non appartiene ad A
    const bad = await fetch(`${SERVER}/api/reservations/${id}/table`, { method: 'PATCH', headers: staff(), body: JSON.stringify({ tableId: envB.tableId }) })
    expect(bad.status).toBe(404)
  })
})

describe('Prenotazioni: validazione', () => {
  it('senza nome/telefono → 400', async () => {
    const r = await fetch(`${SERVER}/api/reservations`, { method: 'POST', headers: staff(), body: JSON.stringify({ partySize: 2, startsAt: at('2027-03-01', '20:00') }) })
    expect(r.status).toBe(400)
  })
  it('senza autenticazione → 401', async () => {
    const r = await fetch(`${SERVER}/api/reservations?date=2027-03-01`)
    expect(r.status).toBe(401)
  })
  it('id inesistente su DELETE → 404', async () => {
    // DELETE senza body: solo cookie, niente Content-Type (come TakoAPI.del del client).
    const r = await fetch(`${SERVER}/api/reservations/${randomUUID()}`, { method: 'DELETE', headers: { Cookie: `tako_session=${env.staffToken}` } })
    expect(r.status).toBe(404)
  })
})
