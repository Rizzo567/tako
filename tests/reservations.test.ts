import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { randomUUID } from 'node:crypto'
import { io, type Socket } from 'socket.io-client'
import { seedTestEnv, jsonHeaders, waitForEvent, SERVER, type TestEnv } from './helpers'

let env: TestEnv        // ristorante A
let envB: TestEnv       // ristorante B (per lo scoping tenant)
let closeA: () => Promise<void>
let closeB: () => Promise<void>
let phone: string       // Bearer di un telefono arruolato: il canale dell'app owner
const sockets: Socket[] = []

beforeAll(async () => {
  const a = await seedTestEnv(); env = a.env; closeA = a.close
  const b = await seedTestEnv(); envB = b.env; closeB = b.close

  // L'app del ristoratore non ha cookie: parla con `Authorization: Bearer` di un
  // dispositivo arruolato (F2.1). I percorsi di F5.2 si provano su QUEL canale,
  // non sulla sessione staff, altrimenti si dimostra la cosa sbagliata.
  const codeRes = await fetch(`${SERVER}/api/auth/device/enroll-code`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.staffToken}` },
    body: '{}',
  })
  const { code } = (await codeRes.json()).data as { code: string }
  const enrolled = await fetch(`${SERVER}/api/auth/device/enroll`, {
    method: 'POST',
    headers: jsonHeaders(),
    body: JSON.stringify({ code, deviceName: 'Telefono prenotazioni', platform: 'iOS' }),
  })
  phone = ((await enrolled.json()).data as { token: string }).token
})
afterAll(async () => { for (const s of sockets) s.close(); await closeA?.(); await closeB?.() })

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

// ─────────────────────────────────────────────────────────────────────────────
// F5.2 — i percorsi che usa davvero la schermata Prenotazioni dell'app.
//
// I test sopra provano le REGOLE del server (anti-overbooking, tenant, validazione).
// Questi provano il GIRO che fa il telefono, che è un'altra cosa: le stesse rotte
// chiamate col Bearer di un dispositivo arruolato, con i corpi che la schermata
// costruisce davvero, e con gli assert su ciò che la schermata poi disegna.
//
// Tre proprietà valgono più delle altre, perché se cadono la sera si rompe:
//   • la lista di «oggi» torna ORDINATA e già arricchita col numero del tavolo —
//     la riga si disegna senza una seconda chiamata per ogni prenotazione;
//   • il 409 del tavolo occupato porta un MESSAGGIO leggibile, che l'app mostra
//     parola per parola invece di tradurlo in un «errore» che non spiega niente;
//   • ogni scrittura emette `reservation:changed`, che è l'unico modo in cui il
//     telefono in mano al ristoratore scopre la prenotazione presa in cassa.
const dayKey = (offset: number) => {
  const d = new Date()
  d.setDate(d.getDate() + offset)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

interface ResvRow {
  id: string
  customerName: string
  customerPhone: string
  partySize: number
  startsAt: string
  durationMin: number
  status: string
  tableId: string | null
  tableNumber: string | null
  notes: string | null
}

describe('F5.2 — i percorsi della schermata Prenotazioni', () => {
  const bearer = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${phone}` })

  /** Il corpo che compone `NuovaSheet`: nome, telefono, persone, ora. Nient'altro. */
  const fromApp = (name: string, day: string, hhmm: string, extra: Record<string, unknown> = {}) => ({
    customerName: name,
    customerPhone: '+39 333 1234567',
    partySize: 4,
    startsAt: new Date(`${day}T${hhmm}:00`).toISOString(),
    ...extra,
  })

  async function appCreate(name: string, day: string, hhmm: string, extra: Record<string, unknown> = {}) {
    const res = await fetch(`${SERVER}/api/reservations`, { method: 'POST', headers: bearer(), body: JSON.stringify(fromApp(name, day, hhmm, extra)) })
    return { status: res.status, body: (await res.json()) as { data?: ResvRow; error?: { code: string; message: string } } }
  }

  async function appList(day: string): Promise<ResvRow[]> {
    const res = await fetch(`${SERVER}/api/reservations?date=${day}`, { headers: { Authorization: `Bearer ${phone}` } })
    expect(res.status).toBe(200)
    return (await res.json()).data as ResvRow[]
  }

  const appPatch = (id: string, path: string, body: unknown) =>
    fetch(`${SERVER}/api/reservations/${id}/${path}`, { method: 'PATCH', headers: bearer(), body: JSON.stringify(body) })

  it('la lista di oggi torna ordinata per ora e già pronta da disegnare', async () => {
    const today = dayKey(0)
    // Inserite in disordine: è il server a doverle rimettere in fila, perché la
    // schermata le stampa nell'ordine in cui arrivano.
    await appCreate('Zeta Tardi', today, '21:45')
    await appCreate('Alfa Presto', today, '19:15', { tableId: env.tableId, notes: 'Seggiolone' })
    await appCreate('Mezzo Servizio', today, '20:30')

    const rows = (await appList(today)).filter((r) => ['Zeta Tardi', 'Alfa Presto', 'Mezzo Servizio'].includes(r.customerName))
    expect(rows.map((r) => r.customerName)).toEqual(['Alfa Presto', 'Mezzo Servizio', 'Zeta Tardi'])

    // La riga si disegna con quello che c'è qui dentro: ora, nome, persone, tavolo,
    // stato. Il numero del tavolo arriva già risolto (join lato server): senza,
    // servirebbe una GET /tables per riga.
    const first = rows[0]!
    expect(first.tableNumber).toBe(env.tableNumber)
    expect(first.partySize).toBe(4)
    expect(first.notes).toBe('Seggiolone')
    expect(first.status).toBe('requested')
    // Chi non ha tavolo lo dichiara con null, non con una stringa vuota.
    expect(rows[1]!.tableId).toBeNull()
    expect(rows[1]!.tableNumber).toBeNull()
  })

  it('«domani» è la stessa rotta con un altro ?date=, e le due liste non si mescolano', async () => {
    const today = dayKey(0)
    const tomorrow = dayKey(1)
    await appCreate('Domani Sera', tomorrow, '20:00')

    const oggi = await appList(today)
    const domani = await appList(tomorrow)
    expect(domani.some((r) => r.customerName === 'Domani Sera')).toBe(true)
    expect(oggi.some((r) => r.customerName === 'Domani Sera')).toBe(false)
    // E il giorno dopo ancora è vuoto: la chiave giorno non "sbava" di 24 ore.
    expect((await appList(dayKey(2))).length).toBe(0)
  })

  it('crea con i quattro campi che la schermata chiede: durata 90 e «da confermare» sono impliciti', async () => {
    const { status, body } = await appCreate('Minimo Sindacale', dayKey(3), '20:00')
    expect(status).toBe(201)
    // L'app NON manda durationMin né status: se il default del server cambiasse,
    // la sera si accorcerebbe o si allungherebbe senza che nessuno l'abbia deciso.
    expect(body.data!.durationMin).toBe(90)
    expect(body.data!.status).toBe('requested')
    expect(body.data!.tableId).toBeNull()
  })

  it('assegnare un tavolo occupato risponde 409 col messaggio che l\'app mostra parola per parola', async () => {
    const day = dayKey(4)
    const occupata = await appCreate('Tiene il Tavolo', day, '20:00', { tableId: env.tableId })
    expect(occupata.status).toBe(201)
    const senzaTavolo = await appCreate('Cerca Tavolo', day, '20:30')

    const res = await appPatch(senzaTavolo.body.data!.id, 'table', { tableId: env.tableId })
    expect(res.status).toBe(409)
    const err = (await res.json()).error as { code: string; message: string }
    expect(err.code).toBe('RESERVATION_OVERLAP')
    // Il testo è il contratto: la schermata lo stampa nel foglio senza riscriverlo.
    // Un messaggio vuoto o generico qui diventa "Operazione non riuscita" a schermo.
    expect(err.message).toBe('Il tavolo è già prenotato in quella fascia oraria.')
    expect(err.message.length).toBeGreaterThan(20)
  })

  it('«Arrivati» e «Non presentati» sono due PATCH mirate che non toccano il tavolo', async () => {
    const day = dayKey(5)
    const a = await appCreate('Famiglia Arrivata', day, '20:00', { tableId: env.tableId })
    const id = a.body.data!.id

    const seated = await appPatch(id, 'status', { status: 'seated' })
    expect(seated.status).toBe(200)
    const dopoSeated = (await seated.json()).data as ResvRow
    expect(dopoSeated.status).toBe('seated')
    expect(dopoSeated.tableId).toBe(env.tableId)   // il tavolo resta assegnato

    const noShow = await appPatch(id, 'status', { status: 'no_show' })
    expect(noShow.status).toBe(200)
    const dopoNoShow = (await noShow.json()).data as ResvRow
    expect(dopoNoShow.status).toBe('no_show')
    expect(dopoNoShow.tableId).toBe(env.tableId)

    // Chi non si è presentato resta nella lista (sbiadito, non sparito): la sera va
    // chiusa sapendo quante prenotazioni sono andate a vuoto.
    const rows = await appList(day)
    expect(rows.some((r) => r.id === id && r.status === 'no_show')).toBe(true)
  })

  it('togliere il tavolo con tableId:null restituisce la fascia a un\'altra prenotazione', async () => {
    const day = dayKey(6)
    const prima = await appCreate('Occupa e Libera', day, '20:00', { tableId: env.tableId })
    const seconda = await appCreate('Aspetta il Posto', day, '20:30')

    // Finché il tavolo è preso, l'assegnazione è rifiutata…
    expect((await appPatch(seconda.body.data!.id, 'table', { tableId: env.tableId })).status).toBe(409)
    // …poi il ristoratore lo toglie dalla prima ("Togli il tavolo" nel foglio)…
    const staccata = await appPatch(prima.body.data!.id, 'table', { tableId: null })
    expect(staccata.status).toBe(200)
    expect(((await staccata.json()).data as ResvRow).tableId).toBeNull()
    // …e ora la seconda lo prende.
    expect((await appPatch(seconda.body.data!.id, 'table', { tableId: env.tableId })).status).toBe(200)
  })

  it('ogni scrittura emette reservation:changed nella room del ristorante', async () => {
    // Il socket del TELEFONO: token in query + come argomento di join:restaurant,
    // esattamente come lo apre lib/live.tsx.
    const socket = io(SERVER, { transports: ['websocket'], query: { token: phone } })
    sockets.push(socket)
    await new Promise<void>((res, rej) => {
      socket.on('connect', () => res())
      socket.on('connect_error', rej)
      setTimeout(() => rej(new Error('socket connect timeout')), 5000)
    })
    socket.emit('join:restaurant', env.restaurantId, phone)
    await new Promise((r) => setTimeout(r, 400))

    const day = dayKey(7)
    const creata = waitForEvent(socket, 'reservation:changed', 4000)
    const nuova = await appCreate('Presa in Cassa', day, '20:00')
    expect((await creata).id).toBe(nuova.body.data!.id)

    const cambiata = waitForEvent(socket, 'reservation:changed', 4000)
    await appPatch(nuova.body.data!.id, 'status', { status: 'seated' })
    expect((await cambiata).id).toBe(nuova.body.data!.id)

    const assegnata = waitForEvent(socket, 'reservation:changed', 4000)
    await appPatch(nuova.body.data!.id, 'table', { tableId: env.tableId })
    expect((await assegnata).id).toBe(nuova.body.data!.id)

    // Anche la cancellazione: senza, la riga resterebbe sugli altri telefoni.
    const eliminata = waitForEvent(socket, 'reservation:changed', 4000)
    const del = await fetch(`${SERVER}/api/reservations/${nuova.body.data!.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${phone}` } })
    expect(del.status).toBe(200)
    expect((await eliminata).id).toBe(nuova.body.data!.id)
    expect((await appList(day)).some((r) => r.customerName === 'Presa in Cassa')).toBe(false)

    socket.close()
  })
})
