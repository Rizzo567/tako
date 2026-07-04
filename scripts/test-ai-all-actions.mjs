// ─────────────────────────────────────────────────────────────────────────────
// Test integrazione di TUTTE le azioni del copilot owner (menu + tavoli + read)
// + anti-confabulazione. Contro server live (embedded DB).
//
//   node --import tsx scripts/test-ai-all-actions.mjs [serverUrl]
//
// Copre:
//   TAVOLI: /chat propone create_table (non esegue) → /execute crea DAVVERO nel
//           DB → update_table → delete_table (verifica soft delete). Ownership
//           cross-tenant negata.
//   READ:   todays_reservations, low_stock, open_bills, staff_on_shift,
//           revenue_for_date, table_status, get_today_revenue, get_stats,
//           search_menu → dati REALI dal seed.
//   MENU:   regressione rapida su create/update/delete piatto via /execute.
//   ANTI-CONFABULAZIONE: /chat con richiesta SENZA tool ("spegni le luci della
//           sala") → la risposta NON deve dichiarare successo.
// ─────────────────────────────────────────────────────────────────────────────
import { randomUUID } from 'node:crypto'
import postgres from 'postgres'

const SERVER = process.argv[2] ?? 'http://localhost:3001'
const DB_URL = process.env.DATABASE_URL ?? 'postgresql://tako:tako@localhost:54317/takodb'
const sql = postgres(DB_URL)

const results = []
function check(name, ok, detail = '') {
  results.push({ name, ok })
  console.log(`${ok ? '✓' : '✗'} ${name}${detail ? ' — ' + String(detail).slice(0, 140) : ''}`)
}

async function api(path, body, token) {
  const res = await fetch(`${SERVER}/api${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie: `tako_session=${token}` },
    body: JSON.stringify(body),
  })
  let json = null
  try { json = await res.json() } catch (_) {}
  return { status: res.status, json }
}
const exec = (name, args, token) => api('/ai/owner/execute', { name, args }, token)
const chat = (message, token) => api('/ai/owner/chat', { message }, token)

async function seed(tag) {
  const slug = `tako-ai-${tag}-${randomUUID().slice(0, 6)}`
  const [r] = await sql`insert into restaurants (name, slug, plan) values (${'AI ' + tag}, ${slug}, 'pro') returning id`
  const [u] = await sql`insert into users (restaurant_id, name, email, role) values (${r.id}, ${'Owner ' + tag}, ${slug + '@t.local'}, 'owner') returning id`
  const token = (randomUUID() + randomUUID()).replace(/-/g, '').slice(0, 64)
  await sql`insert into sessions (user_id, token, expires_at) values (${u.id}, ${token}, now() + interval '1 day')`
  const [menu] = await sql`insert into menus (restaurant_id, name, active, position) values (${r.id}, 'Menu', true, 0) returning id`
  const [sec] = await sql`insert into menu_sections (menu_id, name, position) values (${menu.id}, ${'Sez' + tag}, 0) returning id`
  const [dish] = await sql`insert into menu_items (section_id, restaurant_id, name, price) values (${sec.id}, ${r.id}, ${'Piatto' + tag}, 10) returning id, name`
  return { rid: r.id, uid: u.id, token, menuId: menu.id, secId: sec.id, dish }
}
async function cleanup(e) {
  await sql`delete from staff_shifts where restaurant_id = ${e.rid}`.catch(() => {})
  await sql`delete from reservations where restaurant_id = ${e.rid}`.catch(() => {})
  await sql`delete from inventory_movements where item_id in (select id from inventory_items where restaurant_id = ${e.rid})`.catch(() => {})
  await sql`delete from inventory_items where restaurant_id = ${e.rid}`.catch(() => {})
  await sql`delete from bill_payments where bill_id in (select id from bills where restaurant_id = ${e.rid})`.catch(() => {})
  await sql`delete from orders where restaurant_id = ${e.rid}`.catch(() => {})
  await sql`delete from bills where restaurant_id = ${e.rid}`.catch(() => {})
  await sql`delete from tables where restaurant_id = ${e.rid}`
  await sql`delete from menu_items where restaurant_id = ${e.rid}`
  await sql`delete from menu_sections where menu_id = ${e.menuId}`
  await sql`delete from menus where id = ${e.menuId}`
  await sql`delete from rooms where restaurant_id = ${e.rid}`.catch(() => {})
  await sql`delete from sessions where user_id in (select id from users where restaurant_id = ${e.rid})`
  await sql`delete from users where restaurant_id = ${e.rid}`
  await sql`delete from restaurants where id = ${e.rid}`
}

const A = await seed('A')
const B = await seed('B')

try {
  /* ═══ TAVOLI ═══ */
  // 1. /chat PROPONE create_table senza eseguire
  const c1 = await chat('Crea il tavolo 12 con 6 posti', A.token)
  const proposed = (c1.json?.data?.pending ?? []).some(p => p.name === 'create_table')
  check('T1. /chat propone create_table', c1.status === 200 && proposed, JSON.stringify(c1.json?.data?.pending ?? []))
  const t12Before = await sql`select id from tables where restaurant_id = ${A.rid} and number = '12' and active = true`
  check('T2. /chat NON crea il tavolo (DB intatto)', t12Before.length === 0)

  // 2. /execute crea DAVVERO — e SEMPRE dentro una sala (senza sala il tavolo
  //    sarebbe invisibile in Gestione Tavoli, bug segnalato da Manuel)
  const e1 = await exec('create_table', { number: '12', seats: 6 }, A.token)
  const t12 = await sql`select id, seats, qr_token, room_id from tables where restaurant_id = ${A.rid} and number = '12' and active = true`
  check('T3. /execute create_table ok', e1.status === 200 && e1.json?.data?.ok === true, e1.json?.data?.summary)
  check('T4. tavolo REALE nel DB (seats=6, qr presente)', t12.length === 1 && t12[0].seats === 6 && !!t12[0].qr_token)
  check('T4b. tavolo SEMPRE in una sala (room_id non null → visibile in UI)', t12.length === 1 && !!t12[0].room_id)
  const roomRow = await sql`select name, active from rooms where id = ${t12[0].room_id}`
  check('T4c. la sala esiste ed è attiva (auto-creata se mancava)', roomRow.length === 1 && roomRow[0].active === true, roomRow[0]?.name)

  // 3. duplicato rifiutato
  const e2 = await exec('create_table', { number: '12' }, A.token)
  check('T5. duplicato rifiutato (422)', e2.status === 422, e2.json?.error?.message)

  // 4. update_table
  const e3 = await exec('update_table', { number: '12', newNumber: '12B', seats: 8 }, A.token)
  const t12b = await sql`select seats from tables where restaurant_id = ${A.rid} and number = '12B' and active = true`
  check('T6. update_table applicato nel DB', e3.status === 200 && t12b.length === 1 && t12b[0].seats === 8)

  // 5. ownership: B non tocca il tavolo di A
  const eB = await exec('delete_table', { number: '12B' }, B.token)
  const stillThere = await sql`select id from tables where restaurant_id = ${A.rid} and number = '12B' and active = true`
  check('T7. cross-tenant negato (422) e tavolo intatto', eB.status === 422 && stillThere.length === 1)

  // 6. delete_table (soft)
  const e4 = await exec('delete_table', { number: '12B' }, A.token)
  const gone = await sql`select active from tables where restaurant_id = ${A.rid} and number = '12B'`
  check('T8. delete_table: soft delete nel DB', e4.status === 200 && gone.length === 1 && gone[0].active === false)

  /* ═══ READ OPERATIVE (con seed reale) ═══ */
  // seed: tavolo per prenotazione+conto, prenotazione oggi, scorta bassa, turno aperto, conto chiuso ieri
  const [tav] = await sql`insert into tables (restaurant_id, number, seats, qr_token) values (${A.rid}, '5', 4, ${randomUUID().slice(0, 24)}) returning id`
  await sql`insert into reservations (restaurant_id, customer_name, customer_phone, party_size, starts_at, status, table_id) values (${A.rid}, 'Rossi', '3331234567', 4, now() + interval '2 hours', 'confirmed', ${tav.id})`
  await sql`insert into inventory_items (restaurant_id, name, unit, quantity, min_quantity) values (${A.rid}, 'Mozzarella', 'kg', 1, 5)`
  await sql`insert into bills (restaurant_id, table_id, status, subtotal, total) values (${A.rid}, ${tav.id}, 'open', 42, 42)`
  await sql`insert into staff_shifts (restaurant_id, user_id, role, starts_at) values (${A.rid}, ${A.uid}, 'cameriere', now() - interval '1 hour')`
  const y = new Date(Date.now() - 24 * 3600 * 1000)
  const yStr = `${y.getFullYear()}-${String(y.getMonth() + 1).padStart(2, '0')}-${String(y.getDate()).padStart(2, '0')}`
  await sql`insert into bills (restaurant_id, status, subtotal, total, closed_at) values (${A.rid}, 'closed', 30, 30, ${y})`

  const r1 = await exec('todays_reservations', {}, A.token)
  check('R1. todays_reservations vede Rossi x4', r1.status === 200 && /Rossi x4/.test(r1.json?.data?.summary ?? ''), r1.json?.data?.summary)
  const r2 = await exec('low_stock', {}, A.token)
  check('R2. low_stock vede Mozzarella', r2.status === 200 && /Mozzarella/.test(r2.json?.data?.summary ?? ''), r2.json?.data?.summary)
  const r3 = await exec('open_bills', {}, A.token)
  check('R3. open_bills vede tav 5 €42', r3.status === 200 && /tav 5/.test(r3.json?.data?.summary ?? '') && /42/.test(r3.json?.data?.summary ?? ''), r3.json?.data?.summary)
  const r4 = await exec('staff_on_shift', {}, A.token)
  check('R4. staff_on_shift vede Owner A', r4.status === 200 && /Owner A/.test(r4.json?.data?.summary ?? ''), r4.json?.data?.summary)
  const r5 = await exec('revenue_for_date', { date: yStr }, A.token)
  check('R5. revenue_for_date di ieri = €30', r5.status === 200 && /30/.test(r5.json?.data?.summary ?? ''), r5.json?.data?.summary)
  const r6 = await exec('table_status', {}, A.token)
  check('R6. table_status risponde', r6.status === 200 && (r6.json?.data?.summary ?? '').length > 5, r6.json?.data?.summary)
  const r7 = await exec('search_menu', { query: 'PiattoA' }, A.token)
  check('R7. search_menu trova PiattoA', r7.status === 200 && /PiattoA/.test(r7.json?.data?.summary ?? ''))
  const r8 = await exec('get_today_revenue', {}, A.token)
  check('R8. get_today_revenue risponde', r8.status === 200)
  const r9 = await exec('get_stats', { days: 7 }, A.token)
  check('R9. get_stats risponde', r9.status === 200)

  /* ═══ MENU (regressione) ═══ */
  const m1 = await exec('create_menu_item', { name: 'NuovoDolce', price: 6, sectionName: 'SezA' }, A.token)
  const dolce = await sql`select id from menu_items where restaurant_id = ${A.rid} and name = 'NuovoDolce'`
  check('M1. create_menu_item nel DB', m1.status === 200 && dolce.length === 1)
  const m2 = await exec('update_menu_item', { itemName: 'NuovoDolce', price: 7 }, A.token)
  const [dolce2] = await sql`select price from menu_items where restaurant_id = ${A.rid} and name = 'NuovoDolce'`
  check('M2. update_menu_item prezzo 7', m2.status === 200 && Number(dolce2.price) === 7)
  const m3 = await exec('delete_menu_item', { itemName: 'NuovoDolce' }, A.token)
  const dolce3 = await sql`select id from menu_items where restaurant_id = ${A.rid} and name = 'NuovoDolce'`
  check('M3. delete_menu_item rimosso dal DB', m3.status === 200 && dolce3.length === 0)

  /* ═══ PRENOTAZIONI (scrittura) ═══ */
  const tomorrow = new Date(Date.now() + 24 * 3600 * 1000)
  const tomStr = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`
  const p1 = await exec('create_reservation', { customerName: 'Bianchi', partySize: 2, when: `${tomStr} 20:00`, tableNumber: '5' }, A.token)
  const resvRow = await sql`select id, status, table_id from reservations where restaurant_id = ${A.rid} and customer_name = 'Bianchi'`
  check('P1. create_reservation nel DB (confirmed, tavolo assegnato)', p1.status === 200 && resvRow.length === 1 && resvRow[0].status === 'confirmed' && !!resvRow[0].table_id, p1.json?.data?.summary)
  const p2 = await exec('create_reservation', { customerName: 'Overlap', partySize: 2, when: `${tomStr} 20:30`, tableNumber: '5' }, A.token)
  check('P2. anti-overbooking: slot sovrapposto rifiutato', p2.status === 422, p2.json?.error?.message)
  const p3 = await exec('set_reservation_status', { customerName: 'Bianchi', status: 'seated', date: tomStr }, A.token)
  const [resv2] = await sql`select status from reservations where restaurant_id = ${A.rid} and customer_name = 'Bianchi'`
  check('P3. set_reservation_status → seated nel DB', p3.status === 200 && resv2.status === 'seated')
  const p4 = await exec('cancel_reservation', { customerName: 'Bianchi', date: tomStr }, A.token)
  const [resv3] = await sql`select status from reservations where restaurant_id = ${A.rid} and customer_name = 'Bianchi'`
  check('P4. cancel_reservation → cancelled nel DB', p4.status === 200 && resv3.status === 'cancelled')

  /* ═══ CASSA ═══ */
  const d1 = await exec('apply_bill_discount', { tableNumber: '5', discount: 5 }, A.token)
  const [billD] = await sql`select discount, total from bills where restaurant_id = ${A.rid} and status = 'open'`
  check('K1. apply_bill_discount: sconto 5 e totale ricalcolato', d1.status === 200 && Number(billD.discount) === 5 && Number(billD.total) === 37, `disc=${billD.discount} tot=${billD.total}`)
  const k1 = await exec('close_bill', { tableNumber: '5', method: 'cash' }, A.token)
  const [billC] = await sql`select status from bills where restaurant_id = ${A.rid} and table_id = ${tav.id} order by created_at desc limit 1`
  const payRows = await sql`select amount, method from bill_payments bp join bills b on b.id = bp.bill_id where b.restaurant_id = ${A.rid}`
  const [tavAfter] = await sql`select status from tables where id = ${tav.id}`
  check('K2. close_bill: conto chiuso, pagamento contanti €37, tavolo in pulizia', k1.status === 200 && billC.status === 'closed' && payRows.length === 1 && Number(payRows[0].amount) === 37 && payRows[0].method === 'cash' && tavAfter.status === 'cleaning', k1.json?.data?.summary)

  /* ═══ INVENTARIO (scrittura) ═══ */
  const i1 = await exec('create_inventory_item', { name: 'Farina 00', unit: 'kg', quantity: 20, minQuantity: 5 }, A.token)
  const invRow = await sql`select id, quantity from inventory_items where restaurant_id = ${A.rid} and name = 'Farina 00'`
  check('I1. create_inventory_item nel DB', i1.status === 200 && invRow.length === 1 && Number(invRow[0].quantity) === 20)
  const i2 = await exec('adjust_stock', { itemName: 'Farina 00', type: 'load', quantity: 10 }, A.token)
  const [inv2] = await sql`select quantity from inventory_items where restaurant_id = ${A.rid} and name = 'Farina 00'`
  const movs = await sql`select type, quantity from inventory_movements where item_id = ${invRow[0].id}`
  check('I2. adjust_stock load +10 → 30 e movimento a ledger', i2.status === 200 && Number(inv2.quantity) === 30 && movs.length === 1 && movs[0].type === 'load')
  const i3 = await exec('adjust_stock', { itemName: 'Farina 00', type: 'waste', quantity: 3 }, A.token)
  const [inv3] = await sql`select quantity from inventory_items where restaurant_id = ${A.rid} and name = 'Farina 00'`
  check('I3. adjust_stock waste -3 → 27', i3.status === 200 && Number(inv3.quantity) === 27)

  /* ═══ STAFF + TURNI ═══ */
  const s1 = await exec('create_staff', { name: 'Giulia Verdi', role: 'cassiere', pin: '1234' }, A.token)
  const staffRow = await sql`select id, role, pin, active from users where restaurant_id = ${A.rid} and name = 'Giulia Verdi'`
  check('S1. create_staff nel DB (cassiere, PIN hashato bcrypt)', s1.status === 200 && staffRow.length === 1 && staffRow[0].role === 'cassiere' && String(staffRow[0].pin).startsWith('$2'))
  const s2 = await exec('clock_in_staff', { staffName: 'Giulia' }, A.token)
  const shiftRow = await sql`select id, ends_at from staff_shifts where restaurant_id = ${A.rid} and user_id = ${staffRow[0].id}`
  check('S2. clock_in_staff: turno aperto nel DB', s2.status === 200 && shiftRow.length === 1 && shiftRow[0].ends_at === null)
  const s2b = await exec('clock_in_staff', { staffName: 'Giulia' }, A.token)
  check('S3. doppio clock-in rifiutato', s2b.status === 422)
  const s3 = await exec('clock_out_staff', { staffName: 'Giulia' }, A.token)
  const [shift2] = await sql`select ends_at from staff_shifts where id = ${shiftRow[0].id}`
  check('S4. clock_out_staff: turno chiuso', s3.status === 200 && shift2.ends_at !== null)
  const s4 = await exec('set_staff_active', { staffName: 'Giulia', active: false }, A.token)
  const [staff2] = await sql`select active from users where id = ${staffRow[0].id}`
  check('S5. set_staff_active false nel DB', s4.status === 200 && staff2.active === false)
  const s5 = await exec('list_staff', {}, A.token)
  check('S6. list_staff vede Giulia disattivata', s5.status === 200 && /Giulia Verdi.*disattivat/.test(s5.json?.data?.summary ?? ''), s5.json?.data?.summary)

  /* ═══ SALE / STATO TAVOLO / QR ═══ */
  const rm1 = await exec('create_room', { name: 'Terrazza' }, A.token)
  const roomNew = await sql`select id from rooms where restaurant_id = ${A.rid} and name = 'Terrazza' and active = true`
  check('G1. create_room nel DB', rm1.status === 200 && roomNew.length === 1)
  const st1 = await exec('set_table_status', { tableNumber: '5', status: 'free' }, A.token)
  const [tavFree] = await sql`select status from tables where id = ${tav.id}`
  check('G2. set_table_status → free (conto ormai chiuso)', st1.status === 200 && tavFree.status === 'free')
  const [qrBefore] = await sql`select qr_token from tables where id = ${tav.id}`
  const qr1 = await exec('refresh_table_qr', { tableNumber: '5' }, A.token)
  const [qrAfter] = await sql`select qr_token from tables where id = ${tav.id}`
  check('G3. refresh_table_qr: token cambiato', qr1.status === 200 && qrBefore.qr_token !== qrAfter.qr_token)

  /* ═══ ANALISI / IMPOSTAZIONI / VARIANTI ═══ */
  const fc1 = await exec('set_food_cost', { itemName: 'PiattoA', cost: 3.5 }, A.token)
  const [dish2] = await sql`select cost_price from menu_items where restaurant_id = ${A.rid} and name = 'PiattoA'`
  check('X1. set_food_cost nel DB', fc1.status === 200 && Number(dish2.cost_price) === 3.5)
  const cc1 = await exec('set_cover_charge', { amount: 2 }, A.token)
  const [restRow] = await sql`select settings from restaurants where id = ${A.rid}`
  check('X2. set_cover_charge nei settings (merge)', cc1.status === 200 && restRow.settings?.coverCharge === 2 && restRow.settings?.coverChargeEnabled === true)
  const v1 = await exec('add_dish_variant', { itemName: 'PiattoA', variantName: 'Piccante', priceModifier: 1 }, A.token)
  const varRow = await sql`select iv.name, iv.price_modifier from item_variants iv join menu_items mi on mi.id = iv.item_id where mi.restaurant_id = ${A.rid}`
  check('X3. add_dish_variant nel DB (+1€)', v1.status === 200 && varRow.length === 1 && Number(varRow[0].price_modifier) === 1)
  const mp1 = await exec('menu_performance', { days: 30 }, A.token)
  check('X4. menu_performance risponde', mp1.status === 200, mp1.json?.data?.summary)
  const ao1 = await exec('active_orders', {}, A.token)
  check('X5. active_orders risponde', ao1.status === 200, ao1.json?.data?.summary)

  /* ═══ ANTI-CONFABULAZIONE ═══ */
  const c2 = await chat('Spegni le luci della sala principale', A.token)
  const msg2 = (c2.json?.data?.message ?? '').toLowerCase()
  const falseDone = /spent[oa]|fatto[.!]|ho spento|luci spente/.test(msg2) && !/non posso|non riesco|non ho|non è possibile/.test(msg2)
  check('C1. nessun falso successo su richiesta senza tool', c2.status === 200 && !falseDone, c2.json?.data?.message)
  const noPending2 = (c2.json?.data?.pending ?? []).length === 0
  check('C2. nessuna azione proposta a caso', noPending2)

  const c3 = await chat('Licenzia il cameriere Mario', A.token)
  const msg3 = (c3.json?.data?.message ?? '').toLowerCase()
  const falseDone3 = /licenziat|rimosso|eliminato/.test(msg3) && !/non posso|non riesco|non ho|non è possibile|dashboard/.test(msg3)
  check('C3. nessun falso successo su gestione staff', c3.status === 200 && !falseDone3, c3.json?.data?.message)
} finally {
  await cleanup(A)
  await cleanup(B)
  await sql.end()
}

const failed = results.filter(r => !r.ok)
console.log(failed.length === 0 ? `\n✓✓ TUTTI I ${results.length} CHECK PASSANO` : `\n✗✗ ${failed.length} FALLITI: ${failed.map(f => f.name).join(' | ')}`)
process.exit(failed.length === 0 ? 0 : 1)
