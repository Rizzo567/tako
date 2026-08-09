import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { randomUUID } from 'node:crypto'
import postgres from 'postgres'
import { io, type Socket } from 'socket.io-client'
import { seedTestEnv, jsonHeaders, waitForEvent, SERVER, DB_URL, type TestEnv } from './helpers'

// Turni staff: clock-in/out, isolamento tenant, permessi manager vs dipendente.
// NB: richiede il server live con la route /api/shifts registrata (wiring in index.ts).

let a: TestEnv, aClose: () => Promise<void>
let b: TestEnv, bClose: () => Promise<void>
let dip: { id: string; token: string }
let phone: string                 // Bearer del telefono del titolare (canale dell'app)
const sockets: Socket[] = []
const sql = postgres(DB_URL)

// Crea un membro extra (con sessione) nel ristorante dato.
async function addUser(restaurantId: string, role: string): Promise<{ id: string; token: string }> {
  const [u] = await sql`
    insert into users (restaurant_id, name, email, role)
    values (${restaurantId}, ${'Membro ' + role}, ${role + '-' + randomUUID().slice(0, 8) + '@test.local'}, ${role})
    returning id`
  const token = `test_sess_${randomUUID().replace(/-/g, '')}`
  await sql`insert into sessions (user_id, token, expires_at) values (${u!.id}, ${token}, now() + interval '1 day')`
  return { id: u!.id as string, token: token }
}

beforeAll(async () => {
  const sa = await seedTestEnv(); a = sa.env; aClose = sa.close
  const sb = await seedTestEnv(); b = sb.env; bClose = sb.close
  dip = await addUser(a.restaurantId, 'dipendente')

  // Il telefono del titolare: l'app owner non ha cookie, parla in Bearer con la
  // sessione di un dispositivo arruolato (F2.1). F5.3 si prova su quel canale.
  const codeRes = await fetch(`${SERVER}/api/auth/device/enroll-code`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${a.staffToken}` },
    body: '{}',
  })
  const { code } = (await codeRes.json()).data as { code: string }
  const enrolled = await fetch(`${SERVER}/api/auth/device/enroll`, {
    method: 'POST',
    headers: jsonHeaders(),
    body: JSON.stringify({ code, deviceName: 'Telefono turni', platform: 'Android' }),
  })
  phone = ((await enrolled.json()).data as { token: string }).token
})
afterAll(async () => { for (const s of sockets) s.close(); await aClose?.(); await bClose?.(); await sql.end() })

const hdr = (token: string) => jsonHeaders(`tako_session=${token}`)
const post = (token: string, path: string, body: any) =>
  fetch(`${SERVER}/api/shifts${path}`, { method: 'POST', headers: hdr(token), body: JSON.stringify(body) })
const get = (token: string, path: string) =>
  fetch(`${SERVER}/api/shifts${path}`, { headers: hdr(token) })

describe('Turni · clock-in / clock-out', () => {
  it('owner timbra entrata su se stesso → 201 e compare tra gli attivi', async () => {
    const r = await post(a.staffToken, '/clock-in', {})
    expect(r.status).toBe(201)
    const active = (await (await get(a.staffToken, '/active')).json()).data
    expect(active.some((s: any) => s.userId === a.userId && s.endsAt === null)).toBe(true)
  })

  it('doppio clock-in dello stesso membro → 409 ALREADY_CLOCKED_IN', async () => {
    const r = await post(a.staffToken, '/clock-in', {})
    expect(r.status).toBe(409)
    expect((await r.json()).error.code).toBe('ALREADY_CLOCKED_IN')
  })

  it('clock-out chiude il turno (endsAt valorizzato)', async () => {
    const r = await post(a.staffToken, '/clock-out', {})
    expect(r.status).toBe(200)
    expect((await r.json()).data.endsAt).toBeTruthy()
    const active = (await (await get(a.staffToken, '/active')).json()).data
    expect(active.some((s: any) => s.userId === a.userId)).toBe(false)
  })
})

describe('Turni · permessi', () => {
  it('un dipendente NON può timbrare per un altro membro → 403', async () => {
    const r = await post(dip.token, '/clock-in', { userId: a.userId })
    expect(r.status).toBe(403)
  })

  it('un dipendente può timbrare per sé → 201', async () => {
    const r = await post(dip.token, '/clock-in', { userId: dip.id })
    expect(r.status).toBe(201)
    await post(dip.token, '/clock-out', { userId: dip.id })
  })
})

describe('Turni · isolamento tenant', () => {
  it('il manager del ristorante A non può timbrare un utente del ristorante B → 404', async () => {
    const r = await post(a.staffToken, '/clock-in', { userId: b.userId })
    expect(r.status).toBe(404)
  })

  it('i turni di B non compaiono nella lista di A', async () => {
    // crea un turno manuale in B
    const c = await post(b.staffToken, '/', { userId: b.userId, startsAt: new Date().toISOString() })
    expect(c.status).toBe(201)
    const from = new Date(Date.now() - 86400000).toISOString()
    const to = new Date(Date.now() + 86400000).toISOString()
    const listA = (await (await get(a.staffToken, `/?from=${from}&to=${to}`)).json()).data
    expect(listA.every((s: any) => s.userId !== b.userId)).toBe(true)
  })

  it('crea + elimina turno manuale (owner) → 201 poi 200', async () => {
    const c = await post(a.staffToken, '/', { userId: a.userId, startsAt: new Date().toISOString(), role: 'Sala' })
    expect(c.status).toBe(201)
    const id = (await c.json()).data.id
    // DELETE senza body: solo cookie, niente Content-Type (come fa il client reale
    // TakoAPI.del). Con Content-Type: application/json + body vuoto Fastify risponde 400.
    const d = await fetch(`${SERVER}/api/shifts/${id}`, { method: 'DELETE', headers: { Cookie: `tako_session=${a.staffToken}` } })
    expect(d.status).toBe(200)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// F5.3 — i percorsi della schermata «Staff e turni» dell'app.
//
// La schermata fa due letture (`GET /staff`, `GET /shifts/active`) e tre scritture
// (`clock-in`, `clock-out`, `PATCH /staff/:userId`), tutte col Bearer del telefono.
// Le proprietà che contano qui non sono le regole dei turni (già provate sopra) ma
// quello che la schermata PROMETTE a chi la tocca:
//
//   • la lista sa dire chi è in turno e da quando, senza una chiamata per membro;
//   • un doppio tap sul tasto «Entrata» non apre due turni, e il rifiuto arriva con
//     un messaggio che si può mostrare così com'è;
//   • disattivare un account **scollega davvero** tutti i dispositivi di quel
//     membro — è l'avviso scritto nel foglio, e se fosse falso sarebbe una bugia
//     detta al ristoratore nel momento in cui licenzia qualcuno.
interface ActiveShift { id: string; userId: string; startsAt: string; endsAt: string | null; userName: string; role: string | null }
interface StaffRow { id: string; name: string; email: string; role: string; active: boolean; lastLoginAt: string | null }

describe('F5.3 — i percorsi della schermata Staff e turni', () => {
  const bearer = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${phone}` })
  const read = async <T,>(path: string): Promise<T> => {
    const res = await fetch(`${SERVER}${path}`, { headers: { Authorization: `Bearer ${phone}` } })
    expect(res.status).toBe(200)
    return (await res.json()).data as T
  }
  const clock = (verso: 'in' | 'out', userId: string) =>
    fetch(`${SERVER}/api/shifts/clock-${verso}`, { method: 'POST', headers: bearer(), body: JSON.stringify({ userId }) })

  it('le due letture della schermata bastano a disegnare la lista', async () => {
    const membri = await read<StaffRow[]>('/api/staff')
    const titolare = membri.find((m) => m.id === a.userId)!
    // La riga si disegna con questi campi: nome, ruolo, e se l'account è vivo.
    expect(titolare.role).toBe('owner')
    expect(titolare.active).toBe(true)
    expect(membri.some((m) => m.id === dip.id)).toBe(true)
    // La lista dello staff NON è il posto dove cercare un PIN o una password.
    expect(Object.keys(titolare)).not.toContain('pin')
    expect(Object.keys(titolare)).not.toContain('passwordHash')

    expect((await clock('in', dip.id)).status).toBe(201)
    const attivi = await read<ActiveShift[]>('/api/shifts/active')
    const suo = attivi.find((s) => s.userId === dip.id)!
    // «in turno da 2h 12′» si calcola da startsAt; il nome arriva già dal join, così
    // la lista non fa una GET per membro solo per scrivere chi è.
    expect(suo.endsAt).toBeNull()
    expect(suo.userName).toBe('Membro dipendente')
    expect(Date.now() - new Date(suo.startsAt).getTime()).toBeLessThan(60_000)
  })

  it('il doppio tap su «Entrata» non apre due turni e lo dice con parole sue', async () => {
    const res = await clock('in', dip.id)
    expect(res.status).toBe(409)
    const err = (await res.json()).error as { code: string; message: string }
    expect(err.code).toBe('ALREADY_CLOCKED_IN')
    // La schermata mostra `message` così com'è: se fosse vuoto, il ristoratore
    // leggerebbe «Timbratura non riuscita» e non saprebbe che il turno è già aperto.
    expect(err.message).toBe('Il membro è già in turno')
    // E il turno aperto resta UNO.
    expect((await read<ActiveShift[]>('/api/shifts/active')).filter((s) => s.userId === dip.id).length).toBe(1)
  })

  it('«Uscita» chiude il turno e la riga torna fuori servizio', async () => {
    const out = await clock('out', dip.id)
    expect(out.status).toBe(200)
    expect((await out.json()).data.endsAt).toBeTruthy()
    expect((await read<ActiveShift[]>('/api/shifts/active')).some((s) => s.userId === dip.id)).toBe(false)

    // Timbrare l'uscita di chi non è entrato è un errore leggibile, non un 500.
    const again = await clock('out', dip.id)
    expect(again.status).toBe(404)
    expect((await again.json()).error.code).toBe('NOT_CLOCKED_IN')
  })

  it('clock-in e clock-out emettono shift:updated nella room del ristorante', async () => {
    const socket = io(SERVER, { transports: ['websocket'], query: { token: phone } })
    sockets.push(socket)
    await new Promise<void>((res, rej) => {
      socket.on('connect', () => res())
      socket.on('connect_error', rej)
      setTimeout(() => rej(new Error('socket connect timeout')), 5000)
    })
    socket.emit('join:restaurant', a.restaurantId, phone)
    await new Promise((r) => setTimeout(r, 400))

    const entrata = waitForEvent(socket, 'shift:updated', 4000)
    expect((await clock('in', dip.id)).status).toBe(201)
    expect(await entrata).toMatchObject({ userId: dip.id, action: 'clock-in' })

    const uscita = waitForEvent(socket, 'shift:updated', 4000)
    expect((await clock('out', dip.id)).status).toBe(200)
    expect(await uscita).toMatchObject({ userId: dip.id, action: 'clock-out' })
    socket.close()
  })

  it('disattivare un account scollega davvero tutti i suoi dispositivi', async () => {
    // Un membro tutto suo: disattivare `dip` romperebbe i test che vengono dopo, ed è
    // esattamente il tipo di effetto collaterale che questa rotta ha nel mondo vero.
    const tizio = await addUser(a.restaurantId, 'cassiere')
    // Prima è dentro: la sua sessione funziona.
    expect((await fetch(`${SERVER}/api/staff`, { headers: { Authorization: `Bearer ${tizio.token}` } })).status).toBe(200)

    const patch = await fetch(`${SERVER}/api/staff/${tizio.id}`, { method: 'PATCH', headers: bearer(), body: JSON.stringify({ active: false }) })
    expect(patch.status).toBe(200)
    expect((await patch.json()).data.active).toBe(false)

    // È l'avviso scritto nel foglio: «scolleghi SUBITO tutti i suoi dispositivi».
    expect((await fetch(`${SERVER}/api/staff`, { headers: { Authorization: `Bearer ${tizio.token}` } })).status).toBe(401)
    const membri = await read<StaffRow[]>('/api/staff')
    expect(membri.find((m) => m.id === tizio.id)!.active).toBe(false)

    // Riattivare rimette l'account in piedi ma NON resuscita le sessioni cancellate:
    // il vecchio token resta morto e il membro deve rientrare da capo.
    const back = await fetch(`${SERVER}/api/staff/${tizio.id}`, { method: 'PATCH', headers: bearer(), body: JSON.stringify({ active: true }) })
    expect(back.status).toBe(200)
    expect((await back.json()).data.active).toBe(true)
    expect((await fetch(`${SERVER}/api/staff`, { headers: { Authorization: `Bearer ${tizio.token}` } })).status).toBe(401)
  })

  it('solo il titolare può spegnere un account: il telefono di un dipendente no', async () => {
    const res = await fetch(`${SERVER}/api/staff/${dip.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${dip.token}` },
      body: JSON.stringify({ active: false }),
    })
    expect(res.status).toBe(403)
    // E il dipendente è ancora vivo: il rifiuto non ha lasciato scritture a metà.
    expect((await read<StaffRow[]>('/api/staff')).find((m) => m.id === dip.id)!.active).toBe(true)
  })

  it('un membro di un altro ristorante non è raggiungibile da questo telefono', async () => {
    const res = await fetch(`${SERVER}/api/staff/${b.userId}`, { method: 'PATCH', headers: bearer(), body: JSON.stringify({ active: false }) })
    expect(res.status).toBe(404)
    expect((await read<StaffRow[]>('/api/staff')).some((m) => m.id === b.userId)).toBe(false)
  })
})
