// Foglio QR stampabile per la DEMO di vendita.
//
// Perché non basta il QR della dashboard: la dashboard incoda `tako.local` (modalità
// LAN-first). Su reti dove il DNS di sistema non risponde, risolvere `tako.local`
// costa ~5 secondi di timeout prima di cadere su mDNS — cioè il menu si apre in 5
// secondi davanti al cliente. Il QR con IP DIRETTO si apre in millisecondi.
//
// ⚠️ L'IP è quello della rete a cui il Mac è collegato ADESSO. Cambi rete (o accendi
// l'hotspot) → RIGENERA il foglio, altrimenti i QR puntano a un IP che non esiste più.
//
// Uso:
//   DATABASE_URL='postgresql://tako:tako@127.0.0.1:54317/takodb' node scripts/qr-demo.mjs [quanti]
//   → scrive ~/Desktop/Tako-QR-demo.html (aprilo e stampa, oppure mostralo a schermo)
import { writeFileSync } from 'node:fs'
import { homedir, networkInterfaces } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

// `postgres` e `qrcode` sono dipendenze di apps/server (pnpm non le espone alla
// root): risolvo da lì, così lo script gira da qualsiasi cartella.
const require = createRequire(join(dirname(fileURLToPath(import.meta.url)), '..', 'apps', 'server', 'package.json'))
const postgres = require('postgres')
const QRCode = require('qrcode')

const QUANTI = Number(process.argv[2] ?? 6)
const PORTA = process.env.CLIENT_PORT ?? 3002

function ipLan() {
  for (const [nome, addrs] of Object.entries(networkInterfaces())) {
    if (/^(lo|utun|awdl|llw|bridge)/.test(nome)) continue
    for (const a of addrs ?? []) if (a.family === 'IPv4' && !a.internal) return a.address
  }
  return '127.0.0.1'
}

const sql = postgres(process.env.DATABASE_URL ?? 'postgresql://tako:tako@127.0.0.1:54317/takodb')
const [rest] = await sql`select id, name from restaurants limit 1`
// Ordine NUMERICO: `number` è testo, quindi un `order by number` stampa 1, 10, 11…
const tavoli = await sql`
  select number, qr_token from tables
  order by nullif(regexp_replace(number, '\\D', '', 'g'), '')::int nulls last, number
  limit ${QUANTI}`
await sql.end()

const IP = ipLan()
const cards = []
for (const t of tavoli) {
  const url = `http://${IP}:${PORTA}/r/${rest.id}/t/${t.qr_token}`
  const png = await QRCode.toDataURL(url, {
    errorCorrectionLevel: 'H', margin: 1, width: 520,
    color: { dark: '#2A1F1A', light: '#FFFFFF' },
  })
  cards.push(`<article class="card">
    <div class="num">Tavolo ${t.number}</div>
    <img alt="QR tavolo ${t.number}" src="${png}">
    <div class="hint">Inquadra il codice<br><span>Nessuna app da scaricare</span></div>
  </article>`)
}

const html = `<!doctype html>
<html lang="it"><head><meta charset="utf-8">
<title>QR demo — ${rest.name}</title>
<style>
  @page { size: A4; margin: 12mm; }
  * { box-sizing: border-box; }
  body { margin:0; font-family: ui-sans-serif, -apple-system, system-ui, sans-serif; color:#2A1F1A; background:#fff; }
  header { display:flex; justify-content:space-between; align-items:baseline; border-bottom:2px solid #2A1F1A; padding-bottom:6px; margin-bottom:14px; }
  header h1 { font-size:15px; margin:0; letter-spacing:.02em; }
  header code { font-family: ui-monospace, monospace; font-size:11px; color:#7a6a62; }
  .grid { display:grid; grid-template-columns:repeat(2,1fr); gap:10px; }
  .card { border:1.5px solid #2A1F1A; border-radius:14px; padding:12px; text-align:center; break-inside:avoid; }
  .num { font-size:19px; font-weight:700; margin-bottom:6px; }
  .card img { width:100%; max-width:210px; height:auto; }
  .hint { font-size:11px; margin-top:6px; line-height:1.35; }
  .hint span { color:#7a6a62; }
  footer { margin-top:14px; font-size:10px; color:#7a6a62; font-family: ui-monospace, monospace; }
  @media print { footer { position:fixed; bottom:0; } }
</style></head>
<body>
  <header>
    <h1>${rest.name} — QR demo</h1>
    <code>${IP}:${PORTA} · generato ${new Date().toLocaleString('it-IT')}</code>
  </header>
  <div class="grid">${cards.join('\n')}</div>
  <footer>I QR puntano all'IP ${IP}. Se cambi rete o accendi l'hotspot, rigenera: node scripts/qr-demo.mjs</footer>
</body></html>`

const out = join(homedir(), 'Desktop', 'Tako-QR-demo.html')
writeFileSync(out, html)
console.log(`✓ ${tavoli.length} QR generati per "${rest.name}"`)
console.log(`  IP usato : ${IP}:${PORTA}`)
console.log(`  file     : ${out}`)
console.log(`  prova    : http://${IP}:${PORTA}/r/${rest.id}/t/${tavoli[0].qr_token}`)
