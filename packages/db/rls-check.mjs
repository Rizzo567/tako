// Prova locale che la RLS isola per ristorante quando l'app si connette come
// ruolo NON-superuser (tako_app) e imposta app.current_restaurant_id.
// NON tocca il runtime dell'app: è una verifica di readiness per il deploy (T14).
// Uso: node rls-check.mjs
import postgres from 'postgres'

// tako_app è creato dalla migration 0002 (password placeholder di sviluppo).
const APP_URL = process.env.TAKO_APP_URL ?? 'postgresql://tako_app:change_in_production@localhost:5432/takodb'
const SUPER_URL = 'postgresql://tako:tako@localhost:5432/takodb'

const sup = postgres(SUPER_URL, { max: 1 })
const rows = await sup`select id, name from restaurants order by name`
if (rows.length < 2) { console.log('Servono 2 ristoranti per il test.'); process.exit(1) }
const [a, b] = rows
await sup.end()

const app = postgres(APP_URL, { max: 1 })
let pass = 0, fail = 0
const check = (label, ok) => { console.log((ok ? '✅' : '❌') + ' ' + label); ok ? pass++ : fail++ }

// 1) Senza contesto → RLS deve nascondere tutto (non-superuser).
const noCtx = await app`select count(*)::int n from menu_items`
check('senza app.current_restaurant_id → 0 righe visibili', noCtx[0].n === 0)

// 2) Contesto = ristorante A → vede solo i propri item, zero di B.
const ctxA = await app.begin(async (tx) => {
  await tx`select set_config('app.current_restaurant_id', ${a.id}, true)`
  const mine = await tx`select count(*)::int n from menu_items`
  const ofB = await tx`select count(*)::int n from menu_items where restaurant_id = ${b.id}`
  return { mine: mine[0].n, ofB: ofB[0].n }
})
check(`contesto A (${a.name}) → vede ${ctxA.mine} propri item`, ctxA.mine > 0)
check(`contesto A → vede 0 item di B (${b.name})`, ctxA.ofB === 0)

// 3) Contesto = B → vede i propri.
const ctxB = await app.begin(async (tx) => {
  await tx`select set_config('app.current_restaurant_id', ${b.id}, true)`
  const mine = await tx`select count(*)::int n from menu_items`
  return mine[0].n
})
check(`contesto B (${b.name}) → vede ${ctxB} propri item`, ctxB > 0)

await app.end()
console.log(`\nRLS readiness: ${pass} pass, ${fail} fail`)
process.exit(fail ? 1 : 0)
