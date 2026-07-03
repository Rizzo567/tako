// ─────────────────────────────────────────────────────────────────────────────
// Test integrazione delle azioni MENU del copilot owner (delete/update/rename).
//
//   node --import tsx scripts/test-ai-menu-actions.mjs [serverUrl]
//   (server live richiesto; DATABASE_URL per il DB dello stesso server)
//
// Scenari:
//   1. /chat "elimina il piatto X"      → PROPONE delete_menu_item, DB intatto
//   2. /execute delete_menu_item        → piatto rimosso dal DB
//   3. /execute update_menu_item        → prezzo/nome applicati nel DB
//   4. /execute delete_menu_section     → sezione + piatti rimossi
//   5. /execute rename_menu_section     → nome cambiato
//   6. ownership: il ristorante B NON può toccare i dati di A (422 + DB intatto)
//   7. /chat non esegue MAI mutation anche se richiesto esplicitamente
// ─────────────────────────────────────────────────────────────────────────────
import { randomUUID } from 'node:crypto'
import postgres from 'postgres'

const SERVER = process.argv[2] ?? 'http://localhost:3001'
const DB_URL = process.env.DATABASE_URL ?? 'postgresql://tako:tako@localhost:54317/takodb'
const sql = postgres(DB_URL)

async function seedRestaurant(tag) {
  const slug = `tako-test-ai-${tag}-${randomUUID().slice(0, 6)}`
  const [r] = await sql`insert into restaurants (name, slug, plan, primary_color) values (${'AI Test ' + tag}, ${slug}, 'pro', '#ED7159') returning id`
  const [u] = await sql`insert into users (restaurant_id, name, email, role) values (${r.id}, ${'Owner ' + tag}, ${slug + '@test.local'}, 'owner') returning id`
  const token = `test_sess_${randomUUID().replace(/-/g, '')}`
  await sql`insert into sessions (user_id, token, expires_at) values (${u.id}, ${token}, now() + interval '1 day')`
  const [menu] = await sql`insert into menus (restaurant_id, name, active, position) values (${r.id}, 'Menu', true, 0) returning id`
  const [sec] = await sql`insert into menu_sections (menu_id, name, position) values (${menu.id}, ${'SezioneTest' + tag}, 0) returning id`
  const [p1] = await sql`insert into menu_items (section_id, restaurant_id, name, price) values (${sec.id}, ${r.id}, ${'PiattoUno' + tag}, 10) returning id, name`
  const [p2] = await sql`insert into menu_items (section_id, restaurant_id, name, price) values (${sec.id}, ${r.id}, ${'PiattoDue' + tag}, 12) returning id, name`
  return { restaurantId: r.id, userId: u.id, token, menuId: menu.id, sectionId: sec.id, p1, p2, slug }
}

async function cleanup(env) {
  await sql`delete from menu_items where restaurant_id = ${env.restaurantId}`
  await sql`delete from menu_sections where menu_id = ${env.menuId}`
  await sql`delete from menus where id = ${env.menuId}`
  await sql`delete from sessions where user_id = ${env.userId}`
  await sql`delete from users where id = ${env.userId}`
  await sql`delete from restaurants where id = ${env.restaurantId}`
}

const results = []
function check(name, ok, detail = '') {
  results.push({ name, ok })
  console.log(`${ok ? '✓' : '✗'} ${name}${detail ? ' — ' + detail : ''}`)
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

async function itemExists(id) {
  const rows = await sql`select id from menu_items where id = ${id}`
  return rows.length > 0
}

const A = await seedRestaurant('A')
const B = await seedRestaurant('B')

try {
  // 1+7. /chat deve PROPORRE la delete, non eseguirla
  const chat = await api('/ai/owner/chat', { message: `Elimina definitivamente il piatto "${A.p1.name}" dal menu` }, A.token)
  const proposed = (chat.json?.data?.pending ?? []).some((p) => p.name === 'delete_menu_item')
  check('1. /chat propone delete_menu_item (pending)', chat.status === 200 && proposed,
    `status=${chat.status} pending=${JSON.stringify(chat.json?.data?.pending ?? [])}`)
  check('7. /chat NON esegue la delete (piatto ancora nel DB)', await itemExists(A.p1.id))

  // 2. /execute delete_menu_item → rimosso
  const ex1 = await api('/ai/owner/execute', { name: 'delete_menu_item', args: { itemName: A.p1.name } }, A.token)
  check('2. /execute delete_menu_item ok', ex1.status === 200 && ex1.json?.data?.ok === true, JSON.stringify(ex1.json).slice(0, 120))
  check('2b. piatto realmente rimosso dal DB', !(await itemExists(A.p1.id)))

  // 3. /execute update_menu_item → prezzo + nome
  const ex2 = await api('/ai/owner/execute', { name: 'update_menu_item', args: { itemName: A.p2.name, price: 9.5, name: 'PiattoRinominatoA' } }, A.token)
  const [p2row] = await sql`select name, price from menu_items where id = ${A.p2.id}`
  check('3. /execute update_menu_item ok', ex2.status === 200 && ex2.json?.data?.ok === true)
  check('3b. prezzo e nome applicati nel DB', p2row && Number(p2row.price) === 9.5 && p2row.name === 'PiattoRinominatoA',
    p2row ? `name=${p2row.name} price=${p2row.price}` : 'riga mancante')

  // 6. ownership: B non può eliminare il piatto di A (per nome non lo risolve)
  const exB = await api('/ai/owner/execute', { name: 'delete_menu_item', args: { itemName: 'PiattoRinominatoA' } }, B.token)
  check('6. ownership: B non elimina il piatto di A (422)', exB.status === 422, `status=${exB.status}`)
  check('6b. piatto di A ancora presente', await itemExists(A.p2.id))

  // 5. rename sezione
  const ex3 = await api('/ai/owner/execute', { name: 'rename_menu_section', args: { sectionName: 'SezioneTestA', newName: 'SezioneNuovaA' } }, A.token)
  const [secRow] = await sql`select name from menu_sections where id = ${A.sectionId}`
  check('5. rename_menu_section applicato', ex3.status === 200 && secRow?.name === 'SezioneNuovaA', secRow?.name)

  // 4. delete sezione (con piatto residuo dentro)
  const ex4 = await api('/ai/owner/execute', { name: 'delete_menu_section', args: { sectionName: 'SezioneNuovaA' } }, A.token)
  const secLeft = await sql`select id from menu_sections where id = ${A.sectionId}`
  const itemsLeft = await sql`select id from menu_items where section_id = ${A.sectionId}`
  check('4. delete_menu_section ok', ex4.status === 200 && ex4.json?.data?.ok === true, JSON.stringify(ex4.json?.data?.data ?? {}))
  check('4b. sezione e piatti rimossi dal DB', secLeft.length === 0 && itemsLeft.length === 0)

  // extra: sezione ambigua/inesistente → elenca invece di cancellare
  const ex5 = await api('/ai/owner/execute', { name: 'delete_menu_section', args: { sectionName: 'SezioneCheNonEsiste' } }, B.token)
  check('extra. sezione inesistente → 422 con elenco', ex5.status === 422 && /Sezioni presenti/i.test(ex5.json?.error?.message ?? ''),
    (ex5.json?.error?.message ?? '').slice(0, 90))
} finally {
  await cleanup(A)
  await cleanup(B)
  await sql.end()
}

const failed = results.filter((r) => !r.ok)
console.log(failed.length === 0 ? `\n✓✓ TUTTI I ${results.length} CHECK PASSANO` : `\n✗✗ ${failed.length} FALLITI: ${failed.map((f) => f.name).join(' | ')}`)
process.exit(failed.length === 0 ? 0 : 1)
