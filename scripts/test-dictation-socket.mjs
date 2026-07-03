// Round-trip REALE della dettatura via socket.io contro il server live:
//   1. semina un ambiente test (ristorante+sessione staff) via tests/helpers
//   2. si connette a /dictation col cookie di sessione
//   3. invia il PCM del wav → attende 'result' → verifica testo e motori
//   4. verifica anche il rifiuto senza cookie (auth)
//
//   DATABASE_URL=... node --import tsx scripts/test-dictation-socket.mjs <wav> [server]
import { readFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { io } from 'socket.io-client'
import postgres from 'postgres'

const wavPath = process.argv[2]
const server = process.argv[3] ?? process.env.TAKO_SERVER_URL ?? 'http://localhost:3001'
const DB_URL = process.env.DATABASE_URL ?? 'postgresql://tako:tako@localhost:54317/takodb'

// Semina minima: ristorante + owner + sessione staff (come tests/helpers.ts)
async function seedTestEnv() {
  const sql = postgres(DB_URL)
  const slug = `tako-test-${randomUUID().slice(0, 8)}`
  const [r] = await sql`insert into restaurants (name, slug, plan, primary_color) values ('Tako Test Dict', ${slug}, 'pro', '#ED7159') returning id`
  const [u] = await sql`insert into users (restaurant_id, name, email, role) values (${r.id}, 'Owner Dict', ${slug + '@test.local'}, 'owner') returning id`
  const staffToken = `test_sess_${randomUUID().replace(/-/g, '')}`
  await sql`insert into sessions (user_id, token, expires_at) values (${u.id}, ${staffToken}, now() + interval '1 day')`
  const close = async () => {
    await sql`delete from sessions where token = ${staffToken}`
    await sql`delete from users where id = ${u.id}`
    await sql`delete from restaurants where id = ${r.id}`
    await sql.end()
  }
  return { env: { staffToken }, close }
}

function wavToPcm(buf) {
  const sampleRate = buf.readUInt32LE(24)
  let off = 12
  while (off + 8 <= buf.length) {
    const id = buf.toString('ascii', off, off + 4)
    const size = buf.readUInt32LE(off + 4)
    if (id === 'data') return { pcm: buf.subarray(off + 8, off + 8 + size), sampleRate }
    off += 8 + size + (size % 2)
  }
  throw new Error('data chunk mancante')
}
const { pcm, sampleRate } = wavToPcm(readFileSync(wavPath))

// ── 1. senza auth: deve rifiutare ───────────────────────────────────────────
const unauth = await new Promise((resolve) => {
  const s = io(`${server}/dictation`, { transports: ['websocket'] })
  const t = setTimeout(() => { s.close(); resolve('timeout') }, 8000)
  s.on('asr:error', (e) => { clearTimeout(t); s.close(); resolve(e.message) })
  s.on('result', () => { clearTimeout(t); s.close(); resolve('RESULT-SENZA-AUTH!') })
})
const unauthOk = /sessione staff non valida/i.test(String(unauth))
console.log(`${unauthOk ? '✓' : '✗'} senza cookie → rifiutato (${unauth})`)

// ── 2. con sessione staff vera: round-trip completo ─────────────────────────
const { env, close } = await seedTestEnv()
const t0 = Date.now()
const outcome = await new Promise((resolve) => {
  const s = io(`${server}/dictation`, {
    transports: ['websocket'],
    extraHeaders: { Cookie: `tako_session=${env.staffToken}` },
  })
  const t = setTimeout(() => { s.close(); resolve({ error: 'timeout 120s' }) }, 120_000)
  // 'ready' = auth server completata E listener 'finalize' attaccato:
  // emettere prima significherebbe perdere l'evento (race reale, testata).
  s.on('ready', (st) => {
    console.log('  ready:', JSON.stringify(st))
    s.emit('finalize', { pcm: pcm.buffer.slice(pcm.byteOffset, pcm.byteOffset + pcm.byteLength), sampleRate })
  })
  s.on('asr:error', (e) => { clearTimeout(t); s.close(); resolve({ error: e.message }) })
  s.on('result', (r) => { clearTimeout(t); s.close(); resolve(r) })
})
await close()

if (outcome.error) {
  console.log(`✗ round-trip fallito: ${outcome.error}`)
  process.exit(1)
}
const ms = Date.now() - t0
console.log(`✓ round-trip in ${ms}ms — asr=${outcome.asrEngine}(${outcome.asrMs}ms) cleanup=${outcome.cleanupEngine}(${outcome.cleanupMs}ms)`)
console.log(`  grezzo: ${outcome.raw}`)
console.log(`  pulito: ${outcome.text}`)
const ok = unauthOk && outcome.text && outcome.text.length > 5
console.log(ok ? '\n✓✓ SOCKET E2E PASSA' : '\n✗✗ SOCKET E2E FALLITO')
process.exit(ok ? 0 : 1)
