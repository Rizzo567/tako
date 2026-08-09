// F4.2 — «Finito il branzino»: dal telefono dell'owner al tavolo del cliente.
//
// Il piano chiede un test END-TO-END, e la parola chiave è "end": non basta che la
// PATCH risponda 200 e che la riga a DB cambi. La catena da dimostrare è
//
//   telefono owner (Bearer mobile) → PATCH /api/menus/items/:id/availability
//     → evento `menu:item_availability` sulla room PUBBLICA `menu:{restaurantId}`
//       → il menu servito al cliente non contiene più quella voce
//
// La room pubblica è quella in cui entra la PWA del tavolo con `join:menu`, senza
// alcuna autenticazione: è il canale che fa aggiornare il telefono del cliente
// mentre sta ordinando. Se l'evento non ci arriva, il cliente ordina un piatto che
// non c'è — ed è esattamente il problema che F4.2 esiste per risolvere.
//
// Si verifica anche ciò che sulla room pubblica NON deve viaggiare: `costPrice` (il
// food cost) esce solo sulla room privata del ristorante.
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { io, type Socket } from 'socket.io-client'
import { seedTestEnv, jsonHeaders, waitForEvent, SERVER, type TestEnv } from './helpers.js'

let env: TestEnv
let close: () => Promise<void>
let phone: string
const sockets: Socket[] = []

beforeAll(async () => {
  const s = await seedTestEnv()
  env = s.env
  close = s.close

  const codeRes = await fetch(`${SERVER}/api/auth/device/enroll-code`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.staffToken}` },
    body: '{}',
  })
  const { code } = (await codeRes.json()).data as { code: string }
  const res = await fetch(`${SERVER}/api/auth/device/enroll`, {
    method: 'POST',
    headers: jsonHeaders(),
    body: JSON.stringify({ code, deviceName: 'Telefono menu', platform: 'Android' }),
  })
  phone = ((await res.json()).data as { token: string }).token
})

afterAll(async () => {
  for (const s of sockets) s.close()
  await close?.()
})

const auth = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${phone}` })

/** Il socket del CLIENTE al tavolo: anonimo, entra solo nella room pubblica del menu. */
async function customerSocket(): Promise<Socket> {
  const socket = io(SERVER, { transports: ['websocket'] })
  sockets.push(socket)
  await new Promise<void>((res, rej) => {
    socket.on('connect', () => res())
    socket.on('connect_error', rej)
  })
  socket.emit('join:menu', env.restaurantId)
  // L'ingresso nella room non ha un ack: un giro di event loop del server basta.
  await new Promise((r) => setTimeout(r, 150))
  return socket
}

async function setAvailability(itemId: string, available: boolean) {
  const res = await fetch(`${SERVER}/api/menus/items/${itemId}/availability`, {
    method: 'PATCH',
    headers: auth(),
    body: JSON.stringify({ available }),
  })
  return { status: res.status, body: (await res.json()) as { data?: { available: boolean } } }
}

/** Il menu così come lo riceve il telefono del cliente (nessuna autenticazione). */
async function customerMenu(): Promise<{ id: string; name: string; available: boolean }[]> {
  const res = await fetch(`${SERVER}/api/customer/restaurant/${env.restaurantId}/menu`)
  expect(res.status).toBe(200)
  const data = (await res.json()).data as { sections: { items: { id: string; name: string; available: boolean }[] }[] }
  return data.sections.flatMap((s) => s.items)
}

describe('F4.2 — disponibilità: l\'app owner e il menu del cliente', () => {
  it('la voce segnata finita sparisce dal menu del cliente, e l\'evento arriva alla room pubblica', async () => {
    const socket = await customerSocket()
    expect((await customerMenu()).some((i) => i.id === env.menuItemId)).toBe(true)

    const evt = waitForEvent(socket, 'menu:item_availability')
    const out = await setAvailability(env.menuItemId, false)
    expect(out.status).toBe(200)
    expect(out.body.data?.available).toBe(false)

    const payload = await evt
    expect(payload).toMatchObject({ itemId: env.menuItemId, available: false })

    // Il cliente che ricarica adesso non lo vede più: customer.ts filtra su `available`.
    expect((await customerMenu()).some((i) => i.id === env.menuItemId)).toBe(false)
  })

  it('rimetterla a menu la fa ricomparire, con lo stesso evento al contrario', async () => {
    const socket = await customerSocket()
    const evt = waitForEvent(socket, 'menu:item_availability')
    expect((await setAvailability(env.menuItemId, true)).status).toBe(200)
    expect(await evt).toMatchObject({ itemId: env.menuItemId, available: true })
    expect((await customerMenu()).some((i) => i.id === env.menuItemId)).toBe(true)
  })

  it('il prezzo cambiato dall\'app arriva al cliente SENZA il food cost', async () => {
    // Il food cost esiste sulla riga: se trapelasse, trapelerebbe qui.
    await fetch(`${SERVER}/api/menus/items/${env.menuItemId}`, {
      method: 'PATCH', headers: auth(), body: JSON.stringify({ costPrice: 3.5 }),
    })

    const socket = await customerSocket()
    const evt = waitForEvent(socket, 'menu:updated')
    const res = await fetch(`${SERVER}/api/menus/items/${env.menuItemId}`, {
      method: 'PATCH', headers: auth(), body: JSON.stringify({ price: 13.5 }),
    })
    expect(res.status).toBe(200)

    const payload = await evt as { itemId: string; item: Record<string, unknown> }
    expect(payload.itemId).toBe(env.menuItemId)
    expect(payload.item.price).toBe(13.5)
    expect(payload.item).not.toHaveProperty('costPrice')
    expect(payload.item).not.toHaveProperty('kitchenStation')

    const item = (await customerMenu()).find((i) => i.id === env.menuItemId) as { price?: number } | undefined
    expect(item?.price).toBe(13.5)

    // Ripristino: gli altri test di questo file lavorano sullo stesso piatto.
    await fetch(`${SERVER}/api/menus/items/${env.menuItemId}`, {
      method: 'PATCH', headers: auth(), body: JSON.stringify({ price: env.itemPrice }),
    })
  })

  it('una voce di un altro ristorante non si tocca by-id', async () => {
    const other = await seedTestEnv()
    try {
      const res = await fetch(`${SERVER}/api/menus/items/${other.env.menuItemId}/availability`, {
        method: 'PATCH', headers: auth(), body: JSON.stringify({ available: false }),
      })
      expect(res.status).toBe(404)
      // E la voce dell'altro ristorante è rimasta a menu.
      const menu = await fetch(`${SERVER}/api/customer/restaurant/${other.env.restaurantId}/menu`)
      const data = (await menu.json()).data as { sections: { items: { id: string }[] }[] }
      expect(data.sections.flatMap((s) => s.items).some((i) => i.id === other.env.menuItemId)).toBe(true)
    } finally {
      await other.close()
    }
  })

  it('l\'app legge il menu completo dalla stessa rotta della dashboard', async () => {
    // La schermata carica /menus e poi /menus/:id: se la forma cambiasse (sezioni
    // annidate con dentro le voci) la lista si svuoterebbe senza errori a video.
    const list = (await (await fetch(`${SERVER}/api/menus`, { headers: { Authorization: `Bearer ${phone}` } })).json()).data as { id: string }[]
    expect(list.length).toBeGreaterThan(0)
    const full = (await (await fetch(`${SERVER}/api/menus/${list[0]!.id}`, { headers: { Authorization: `Bearer ${phone}` } })).json()).data as {
      sections: { id: string; name: string; items: { id: string; name: string; price: number; available: boolean }[] }[]
    }
    expect(Array.isArray(full.sections)).toBe(true)
    const flat = full.sections.flatMap((s) => s.items)
    expect(flat.some((i) => i.id === env.menuItemId)).toBe(true)
    expect(typeof flat[0]!.available).toBe('boolean')
    expect(typeof flat[0]!.price).toBe('number')
  })
})
