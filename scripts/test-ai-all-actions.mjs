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
  await sql`delete from inventory_items where restaurant_id = ${e.rid}`.catch(() => {})
  await sql`delete from bills where restaurant_id = ${e.rid}`.catch(() => {})
  await sql`delete from tables where restaurant_id = ${e.rid}`
  await sql`delete from menu_items where restaurant_id = ${e.rid}`
  await sql`delete from menu_sections where menu_id = ${e.menuId}`
  await sql`delete from menus where id = ${e.menuId}`
  await sql`delete from sessions where user_id = ${e.uid}`
  await sql`delete from users where id = ${e.uid}`
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

  // 2. /execute crea DAVVERO
  const e1 = await exec('create_table', { number: '12', seats: 6 }, A.token)
  const t12 = await sql`select id, seats, qr_token from tables where restaurant_id = ${A.rid} and number = '12' and active = true`
  check('T3. /execute create_table ok', e1.status === 200 && e1.json?.data?.ok === true, e1.json?.data?.summary)
  check('T4. tavolo REALE nel DB (seats=6, qr presente)', t12.length === 1 && t12[0].seats === 6 && !!t12[0].qr_token)

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
