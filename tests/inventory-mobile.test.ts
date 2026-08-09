// F4.1 — Magazzino dal telefono.
//
// Il goal del piano è «carico/scarico/spreco registrabili in meno di 4 tap». I tap si
// contano nel browser (`scripts/test-owner-wave2.mjs`); qui si verifica l'altra metà,
// quella che il probe non può vedere: che il movimento partito dall'app arrivi al
// LEDGER con il segno giusto e che la giacenza si muova di conseguenza.
//
// Tutte le chiamate viaggiano con il Bearer di un TELEFONO ARRUOLATO (`sessions.kind
// = 'mobile'`), non con la sessione staff: è il canale reale dell'app, ed è l'unico
// che dimostra che un dispositivo mobile può scrivere sul magazzino.
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import postgres from 'postgres'
import { seedTestEnv, jsonHeaders, SERVER, DB_URL, type TestEnv } from './helpers.js'

let env: TestEnv
let close: () => Promise<void>
let sql: ReturnType<typeof postgres>
let phone: string

beforeAll(async () => {
  const s = await seedTestEnv()
  env = s.env
  close = s.close
  sql = postgres(DB_URL)

  const codeRes = await fetch(`${SERVER}/api/auth/device/enroll-code`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.staffToken}` },
    body: '{}',
  })
  const { code } = (await codeRes.json()).data as { code: string }
  const res = await fetch(`${SERVER}/api/auth/device/enroll`, {
    method: 'POST',
    headers: jsonHeaders(),
    body: JSON.stringify({ code, deviceName: 'Telefono magazzino', platform: 'iOS' }),
  })
  phone = ((await res.json()).data as { token: string }).token
})

afterAll(async () => {
  await sql`delete from inventory_movements where item_id in (select id from inventory_items where restaurant_id = ${env.restaurantId})`
  await sql`delete from inventory_items where restaurant_id = ${env.restaurantId}`
  await sql.end()
  await close?.()
})

const auth = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${phone}` })

async function createItem(over: Record<string, unknown> = {}): Promise<string> {
  const res = await fetch(`${SERVER}/api/inventory`, {
    method: 'POST',
    headers: auth(),
    body: JSON.stringify({ name: `Ingrediente ${Math.random().toString(36).slice(2, 8)}`, unit: 'kg', quantity: 10, minQuantity: 4, ...over }),
  })
  expect(res.status).toBe(201)
  return ((await res.json()).data as { id: string }).id
}

async function movement(itemId: string, type: string, quantity: number, note?: string) {
  const res = await fetch(`${SERVER}/api/inventory/${itemId}/movements`, {
    method: 'POST',
    headers: auth(),
    body: JSON.stringify({ type, quantity, ...(note ? { note } : {}) }),
  })
  return { status: res.status, body: (await res.json()) as { data?: Record<string, unknown>; error?: { code: string } } }
}

async function ledger(itemId: string) {
  const res = await fetch(`${SERVER}/api/inventory/${itemId}/movements`, { headers: { Authorization: `Bearer ${phone}` } })
  expect(res.status).toBe(200)
  return (await res.json()).data as { id: string; type: string; quantity: number; note: string | null }[]
}

async function quantityOf(itemId: string): Promise<number> {
  const res = await fetch(`${SERVER}/api/inventory`, { headers: { Authorization: `Bearer ${phone}` } })
  const items = (await res.json()).data as { id: string; quantity: number }[]
  return items.find((i) => i.id === itemId)!.quantity
}

describe('F4.1 — movimenti di magazzino dal telefono', () => {
  it('il carico entra nel ledger e alza la giacenza', async () => {
    const id = await createItem({ quantity: 10 })
    const { status } = await movement(id, 'load', 6.5, 'consegna del mattino')
    expect(status).toBe(201)

    const moves = await ledger(id)
    expect(moves).toHaveLength(1)
    expect(moves[0]!.type).toBe('load')
    expect(moves[0]!.quantity).toBe(6.5)
    expect(moves[0]!.note).toBe('consegna del mattino')
    expect(await quantityOf(id)).toBeCloseTo(16.5, 2)
  })

  it('scarico e spreco abbassano la giacenza e restano distinti nel ledger', async () => {
    const id = await createItem({ quantity: 10 })
    expect((await movement(id, 'unload', 3)).status).toBe(201)
    expect((await movement(id, 'waste', 2)).status).toBe(201)

    // Il ledger torna in ordine cronologico DECRESCENTE (inventory.ts): l'ultimo
    // movimento è il primo elemento.
    const moves = await ledger(id)
    expect(moves.map((m) => m.type)).toEqual(['waste', 'unload'])
    // Il segno non sta nel numero (che è sempre positivo per questi tre tipi) ma nel
    // TIPO: è il tipo a decidere il delta, ed è il delta che va verificato.
    expect(await quantityOf(id)).toBeCloseTo(5, 2)
  })

  it('la rettifica è l\'unico movimento con segno proprio', async () => {
    const id = await createItem({ quantity: 10 })
    expect((await movement(id, 'adjustment', -4)).status).toBe(201)
    const moves = await ledger(id)
    expect(moves[0]!.type).toBe('adjustment')
    expect(moves[0]!.quantity).toBe(-4)
    expect(await quantityOf(id)).toBeCloseTo(6, 2)

    // Un carico o uno scarico NEGATIVO è un errore di chi chiama, non una rettifica
    // implicita: l'app manda sempre un valore positivo e il tipo.
    const bad = await movement(id, 'unload', -1)
    expect(bad.status).toBe(400)
    // E zero non è un movimento.
    expect((await movement(id, 'load', 0)).status).toBe(400)
  })

  it('la giacenza non scende mai sotto zero', async () => {
    const id = await createItem({ quantity: 2 })
    expect((await movement(id, 'waste', 50)).status).toBe(201)
    expect(await quantityOf(id)).toBe(0)
    // Il ledger però conserva il movimento REALE (50), non quello troncato: è un
    // registro contabile, non lo specchio della giacenza.
    expect((await ledger(id))[0]!.quantity).toBe(50)
  })

  it('sotto la soglia l\'articolo compare in alert e nella lista di riordino', async () => {
    const id = await createItem({ quantity: 10, minQuantity: 4, parLevel: 12, costPerUnit: 3, supplier: 'Ortofrutta Rossi' })
    await movement(id, 'unload', 7) // 10 → 3, sotto il minimo di 4

    const alerts = await (await fetch(`${SERVER}/api/inventory/alerts`, { headers: { Authorization: `Bearer ${phone}` } })).json()
    expect((alerts.data as { id: string }[]).some((i) => i.id === id)).toBe(true)

    const reorder = await (await fetch(`${SERVER}/api/inventory/reorder`, { headers: { Authorization: `Bearer ${phone}` } })).json()
    const supplier = (reorder.data as { suppliers: { supplier: string; items: { id: string; suggested: number; estCost: number }[] }[] })
      .suppliers.find((s) => s.supplier === 'Ortofrutta Rossi')
    const row = supplier!.items.find((i) => i.id === id)!
    // Suggerito = par (12) − giacenza (3). È il numero che l'app propone già scritto
    // nello stepper: se cambiasse, il primo tap del ristoratore ordinerebbe la cosa sbagliata.
    expect(row.suggested).toBeCloseTo(9, 2)
    expect(row.estCost).toBeCloseTo(27, 2)
  })

  it('il consumo di 30 giorni conta scarichi e sprechi, non i carichi', async () => {
    const id = await createItem({ quantity: 20, minQuantity: 1, costPerUnit: 2 })
    await movement(id, 'load', 10)
    await movement(id, 'unload', 4)
    await movement(id, 'waste', 2)

    const stats = await (await fetch(`${SERVER}/api/inventory/stats`, { headers: { Authorization: `Bearer ${phone}` } })).json()
    const row = (stats.data as { perItem: { id: string; used30: number; quantity: number }[] }).perItem.find((i) => i.id === id)!
    expect(row.used30).toBeCloseTo(6, 2)   // 4 + 2, il carico non è consumo
    expect(row.quantity).toBeCloseTo(24, 2) // 20 + 10 − 4 − 2
  })

  it('un articolo di un altro ristorante non è raggiungibile by-id', async () => {
    const other = await seedTestEnv()
    try {
      const res = await fetch(`${SERVER}/api/inventory`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${other.env.staffToken}` },
        body: JSON.stringify({ name: 'Roba altrui', unit: 'kg', quantity: 5, minQuantity: 1 }),
      })
      const foreignId = ((await res.json()).data as { id: string }).id
      const move = await movement(foreignId, 'waste', 1)
      expect(move.status).toBe(404)
      const read = await fetch(`${SERVER}/api/inventory/${foreignId}/movements`, { headers: { Authorization: `Bearer ${phone}` } })
      expect(read.status).toBe(404)
      await sql`delete from inventory_movements where item_id = ${foreignId}`
      await sql`delete from inventory_items where restaurant_id = ${other.env.restaurantId}`
    } finally {
      await other.close()
    }
  })
})
