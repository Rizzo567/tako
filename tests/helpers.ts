import postgres from 'postgres'
import { randomUUID } from 'node:crypto'

export const SERVER = process.env.TAKO_SERVER_URL ?? 'http://localhost:3001'
export const DB_URL = process.env.DATABASE_URL ?? 'postgresql://tako:tako@localhost:5432/takodb'

export interface TestEnv {
  restaurantId: string
  userId: string
  staffToken: string
  tableId: string
  tableNumber: string
  qrToken: string
  menuItemId: string
  itemPrice: number
  variantId: string
  variantModifier: number
}

// Crea un ambiente isolato (ristorante + owner + sessione staff + tavolo + menu
// con una voce) per i test di integrazione. Idempotente: ripulisce i residui
// 'tako-test%' prima di seminare.
export async function seedTestEnv(): Promise<{ env: TestEnv; close: () => Promise<void> }> {
  const sql = postgres(DB_URL)
  // Pre-clean robusto: rimuove SOLO residui vecchi (>30 min) di run andati male,
  // NON i ristoranti appena creati nello stesso run (es. simulazione multi-tenant
  // che semina 3 ambienti di fila). bills/orders non cascadano dal ristorante.
  const stale = await sql`select id from restaurants where slug like 'tako-test%' and created_at < now() - interval '30 minutes'`
  const staleIds = stale.map((r) => r.id as string)
  if (staleIds.length) {
    await sql`delete from bill_payments where bill_id in (select id from bills where restaurant_id in ${sql(staleIds)})`
    await sql`delete from bills where restaurant_id in ${sql(staleIds)}`
    await sql`delete from orders where restaurant_id in ${sql(staleIds)}`
    await sql`delete from menu_items where restaurant_id in ${sql(staleIds)}`
    await sql`delete from table_sessions where restaurant_id in ${sql(staleIds)}`
    await sql`delete from restaurants where id in ${sql(staleIds)}`
  }

  const slug = `tako-test-${randomUUID().slice(0, 8)}`
  const [r] = await sql`
    insert into restaurants (name, slug, plan, primary_color)
    values ('Tako Test', ${slug}, 'pro', '#ED7159') returning id`
  const restaurantId = r!.id as string

  const [u] = await sql`
    insert into users (restaurant_id, name, email, role)
    values (${restaurantId}, 'Test Owner', ${slug + '@test.local'}, 'owner') returning id`
  const userId = u!.id as string

  const staffToken = `test_sess_${randomUUID().replace(/-/g, '')}`
  await sql`insert into sessions (user_id, token, expires_at) values (${userId}, ${staffToken}, now() + interval '1 day')`

  const qrToken = `testqr_${randomUUID().slice(0, 12)}`
  const [t] = await sql`
    insert into tables (restaurant_id, number, seats, qr_token)
    values (${restaurantId}, 'T1', 4, ${qrToken}) returning id, number`
  const tableId = t!.id as string
  const tableNumber = t!.number as string

  const [m] = await sql`
    insert into menus (restaurant_id, name, type, active, position)
    values (${restaurantId}, 'Menu Test', 'main', true, 0) returning id`
  const [sec] = await sql`
    insert into menu_sections (menu_id, name, position, active)
    values (${m!.id}, 'Sezione Test', 0, true) returning id`
  const itemPrice = 10
  const [it] = await sql`
    insert into menu_items (restaurant_id, section_id, name, price, available, position)
    values (${restaurantId}, ${sec!.id}, 'Piatto Test', ${itemPrice}, true, 0) returning id`
  const menuItemId = it!.id as string

  const variantModifier = 5
  const [v] = await sql`
    insert into item_variants (item_id, name, price_modifier, available)
    values (${menuItemId}, 'Maxi', ${variantModifier}, true) returning id`
  const variantId = v!.id as string

  const env: TestEnv = { restaurantId, userId, staffToken, tableId, tableNumber, qrToken, menuItemId, itemPrice, variantId, variantModifier }
  const close = async () => {
    // bills/orders non hanno ON DELETE CASCADE dal ristorante: cancella prima i figli.
    // Ordine FK: bill_payments → orders (orders.bill_id → bills, quindi PRIMA di bills) → bills.
    await sql`delete from bill_payments where bill_id in (select id from bills where restaurant_id = ${restaurantId})`
    await sql`delete from orders where restaurant_id = ${restaurantId}`
    await sql`delete from bills where restaurant_id = ${restaurantId}`
    await sql`delete from menu_items where restaurant_id = ${restaurantId}`
    await sql`delete from table_sessions where restaurant_id = ${restaurantId}`
    await sql`delete from restaurants where id = ${restaurantId}`
    await sql.end()
  }
  return { env, close }
}

// Risolve il tavolo via QR e ritorna il cookie tako_table da usare nelle azioni cliente.
export async function getTableCookie(qrToken: string): Promise<string> {
  const res = await fetch(`${SERVER}/api/customer/table/${qrToken}`)
  const sc = res.headers.get('set-cookie') ?? ''
  const cookie = sc.split(';')[0]
  if (!cookie || !cookie.startsWith('tako_table=')) throw new Error('no table cookie issued')
  return cookie
}

export function jsonHeaders(cookie?: string): Record<string, string> {
  return { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) }
}

// Aspetta il primo evento socket di nome `event` o va in timeout.
export function waitForEvent(socket: any, event: string, timeoutMs = 6000): Promise<any> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timeout waiting for "${event}"`)), timeoutMs)
    socket.once(event, (payload: any) => { clearTimeout(timer); resolve(payload) })
  })
}
