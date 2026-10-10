// Storico di servizio per la VETRINA di vendita.
//
// Perché serve: senza ordini passati, in demo "quanto ho incassato oggi?",
// le statistiche, i piatti più venduti e il menu engineering rispondono ZERO —
// cioè proprio le schermate che convincono il ristoratore.
//
// Cosa fa:
//   - ripulisce gli avanzi di prova (ordini pending/cancelled e conti aperti
//     rimasti da sessioni di test) così Ordini Live e Conti Aperti partono puliti
//   - genera N giorni di servizio plausibile: coperti, pranzo/cena, mix di piatti
//     pesato (le pizze tirano, i secondi meno), pagamenti contanti/carta, coperto
//     applicato, qualche sconto — tutto con date reali distribuite nel tempo
//   - lascia il servizio di OGGI parzialmente aperto (2 tavoli con ordini in
//     corso) così KDS e Sala Live hanno qualcosa da mostrare
//
// Deterministico (nessun Math.random senza seme) → rilanciandolo si ottiene lo
// stesso storico. Idempotente: marca gli ordini con notes='__demo__' e li
// rigenera da zero a ogni esecuzione.
//
// Uso:
//   DATABASE_URL='postgresql://tako:tako@127.0.0.1:54317/takodb' node seed-demo-storico.mjs [giorni]
import postgres from 'postgres'

const sql = postgres(process.env.DATABASE_URL ?? 'postgresql://tako:tako@127.0.0.1:54317/takodb')
const GIORNI = Number(process.argv[2] ?? 21)
const MARK = '__demo__'

// PRNG con seme: storico riproducibile fra un lancio e l'altro.
let seed = 20260809
const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648 }
const pick = arr => arr[Math.floor(rnd() * arr.length)]
const between = (a, b) => a + Math.floor(rnd() * (b - a + 1))

const [rest] = await sql`select id, settings from restaurants limit 1`
const coperto = Number(rest.settings?.coverCharge ?? 2)
const tables = await sql`select id, number, seats from tables order by number`
const items = await sql`
  select i.id, i.name, i.price, i.kitchen_station, s.name sezione
  from menu_items i join menu_sections s on s.id = i.section_id
  where i.available = true`
const [staff] = await sql`select id from users where role = 'owner' order by created_at limit 1`

// Peso commerciale per sezione: quanto spesso un piatto di quella sezione finisce
// in un ordine. Serve a far uscire una matrice di menu engineering credibile.
const PESO = {
  'PIZZE CLASSICHE': 30, 'PIZZE SPECIALI': 14, 'BEVANDE': 26, 'BIRRE': 10,
  'ANTIPASTI': 9, 'PRIMI': 8, 'CONTORNI': 7, 'DOLCI': 6, 'VINI': 4, 'SECONDI': 3,
}
const pool = []
for (const it of items) for (let k = 0; k < (PESO[it.sezione] ?? 5); k++) pool.push(it)

// ── pulizia degli avanzi di prova ────────────────────────────────────────────
// Ordine di cancellazione obbligato dalle foreign key: righe → storico → ordini,
// poi i conti rimasti ORFANI (nessun ordine che li referenzia) con i loro pagamenti.
// L'orfanità è il criterio giusto: marcare i conti chiusi non basterebbe, e senza
// questo passo ogni ri-esecuzione lascerebbe lo storico precedente a doppiare
// l'incasso (bug trovato al secondo lancio).
const daPulire = sql`select id from orders where status in ('pending','cancelled') or notes = ${MARK}`
const delOrdItems = await sql`delete from order_items where order_id in (${daPulire}) returning id`
await sql`delete from order_status_history where order_id in (${daPulire})`
const delOrd = await sql`delete from orders where status in ('pending','cancelled') or notes = ${MARK} returning id`

const orfani = sql`select b.id from bills b where not exists (select 1 from orders o where o.bill_id = b.id)`
const delPay = await sql`delete from bill_payments where bill_id in (${orfani}) returning id`
const delBill = await sql`delete from bills where id in (${orfani}) returning id`
await sql`update tables set status = 'free'`

// ── generazione ──────────────────────────────────────────────────────────────
const oggi = new Date()
oggi.setHours(0, 0, 0, 0)
let nOrdini = 0, nConti = 0, incassoTot = 0

for (let g = GIORNI - 1; g >= 0; g--) {
  const giorno = new Date(oggi.getTime() - g * 86400000)
  const dow = giorno.getDay() // 0 dom … 6 sab
  // venerdì e sabato pieni, lunedì scarico
  const coperti = dow === 5 || dow === 6 ? between(26, 38) : dow === 1 ? between(8, 14) : between(14, 24)
  let serviti = 0

  while (serviti < coperti) {
    const tavolo = pick(tables)
    const persone = Math.min(tavolo.seats, between(2, 4))
    serviti += persone

    // pranzo (12–14) o cena (19:30–22:30), cena più probabile
    const cena = rnd() > 0.35
    const ora = cena ? between(19, 22) : between(12, 14)
    const minuto = between(0, 59)
    const apertura = new Date(giorno)
    apertura.setHours(ora, minuto, 0, 0)
    // il servizio di OGGI dopo l'ora corrente non esiste ancora
    if (g === 0 && apertura > new Date()) continue

    // righe dell'ordine: 1 piatto a testa + bevande + a volte dolce
    const righe = []
    for (let p = 0; p < persone; p++) righe.push(pick(pool))
    for (let p = 0; p < Math.ceil(persone * 0.8); p++) righe.push(pick(pool.filter(x => x.sezione === 'BEVANDE' || x.sezione === 'BIRRE')))
    if (rnd() > 0.6) righe.push(pick(pool.filter(x => x.sezione === 'DOLCI')))

    const subtotale = righe.reduce((s, r) => s + Number(r.price), 0)
    const copertoTot = coperto * persone
    // qualche sconto sparso (amici, gruppi)
    const sconto = rnd() > 0.9 ? Math.round(subtotale * 0.1 * 100) / 100 : 0
    const totale = Math.round((subtotale + copertoTot - sconto) * 100) / 100

    // il servizio di oggi: gli ultimi 2 tavoli restano APERTI (KDS + Sala Live)
    const apertoOra = g === 0 && rnd() > 0.82
    const chiusura = new Date(apertura.getTime() + between(45, 95) * 60000)

    const [bill] = await sql`
      insert into bills (restaurant_id, table_id, table_number, subtotal, discount, discount_note, tip, total, covers, status, closed_by, created_at, closed_at)
      values (${rest.id}, ${tavolo.id}, ${tavolo.number}, ${subtotale + copertoTot}, ${sconto},
              ${sconto ? MARK : null}, 0, ${totale}, ${persone},
              ${apertoOra ? 'open' : 'closed'}, ${apertoOra ? null : staff.id},
              ${apertura}, ${apertoOra ? null : chiusura})
      returning id`
    nConti++

    const [ordine] = await sql`
      insert into orders (restaurant_id, table_id, table_number, type, bill_id, status, total, notes, created_at, updated_at, served_at, paid_at)
      values (${rest.id}, ${tavolo.id}, ${tavolo.number}, 'table', ${bill.id},
              ${apertoOra ? 'preparing' : 'paid'}, ${subtotale}, ${MARK},
              ${apertura}, ${apertura},
              ${apertoOra ? null : new Date(apertura.getTime() + 20 * 60000)},
              ${apertoOra ? null : chiusura})
      returning id`
    nOrdini++

    for (const r of righe) {
      await sql`
        insert into order_items (order_id, menu_item_id, name, quantity, unit_price, kitchen_station, status, created_at)
        values (${ordine.id}, ${r.id}, ${r.name}, 1, ${r.price}, ${r.kitchen_station ?? null},
                ${apertoOra ? 'preparing' : 'served'}, ${apertura})`
    }

    if (!apertoOra) {
      await sql`
        insert into bill_payments (bill_id, amount, method, created_at)
        values (${bill.id}, ${totale}, ${rnd() > 0.45 ? 'card' : 'cash'}, ${chiusura})`
      incassoTot += totale
      if (rnd() > 0.75) await sql`update tables set status = 'free' where id = ${tavolo.id}`
    } else {
      await sql`update tables set status = 'occupied' where id = ${tavolo.id}`
    }
  }
}

// ── servizio VIVO: garantisco 2 tavoli in corso ──────────────────────────────
// Senza questo, Sala Live e KDS in demo sono vuoti (il generatore lascia aperti
// solo i tavoli del servizio in corso, che a metà pomeriggio non esistono).
const [{ n: apertiOra }] = await sql`select count(*)::int n from bills where status = 'open'`
for (let k = apertiOra; k < 2; k++) {
  const tavolo = tables[k % tables.length]
  const persone = Math.min(tavolo.seats, 2 + k)
  const righe = []
  for (let p = 0; p < persone; p++) righe.push(pick(pool))
  righe.push(pick(pool.filter(x => x.sezione === 'BEVANDE')))
  const subtotale = righe.reduce((s, r) => s + Number(r.price), 0)
  const apertura = new Date(Date.now() - (12 + k * 9) * 60000) // 12 e 21 minuti fa
  const [bill] = await sql`
    insert into bills (restaurant_id, table_id, table_number, subtotal, discount, tip, total, covers, status, created_at)
    values (${rest.id}, ${tavolo.id}, ${tavolo.number}, ${subtotale + coperto * persone}, 0, 0,
            ${subtotale + coperto * persone}, ${persone}, 'open', ${apertura})
    returning id`
  const [ordine] = await sql`
    insert into orders (restaurant_id, table_id, table_number, type, bill_id, status, total, notes, created_at, updated_at)
    values (${rest.id}, ${tavolo.id}, ${tavolo.number}, 'table', ${bill.id},
            ${k === 0 ? 'preparing' : 'confirmed'}, ${subtotale}, ${MARK}, ${apertura}, ${apertura})
    returning id`
  for (const r of righe) {
    await sql`
      insert into order_items (order_id, menu_item_id, name, quantity, unit_price, kitchen_station, status, created_at)
      values (${ordine.id}, ${r.id}, ${r.name}, 1, ${r.price}, ${r.kitchen_station ?? null},
              ${k === 0 ? 'preparing' : 'pending'}, ${apertura})`
  }
  await sql`update tables set status = 'occupied' where id = ${tavolo.id}`
  nOrdini++; nConti++
}

const [oggiTot] = await sql`
  select coalesce(sum(p.amount),0) tot, count(*) n
  from bill_payments p join bills b on b.id = p.bill_id
  where p.created_at::date = current_date`
const [aperti] = await sql`select count(*) n from bills where status = 'open'`

console.log('--- STORICO DEMO ---')
console.log('avanzi rimossi     :', `${delOrd.length} ordini, ${delBill.length} conti, ${delPay.length} pagamenti, ${delOrdItems.length} righe`)
console.log('giorni generati    :', GIORNI)
console.log('ordini creati      :', nOrdini)
console.log('conti creati       :', nConti)
console.log('incasso totale     : €', incassoTot.toFixed(2))
console.log('incasso di OGGI    : €', Number(oggiTot.tot).toFixed(2), `(${oggiTot.n} conti pagati)`)
console.log('tavoli ancora aperti:', aperti.n)

await sql.end()
