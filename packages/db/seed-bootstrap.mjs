// Bootstrap dev: crea i due ristoranti demo con UUID fissi (quelli che
// seed-demo.mjs si aspetta) + un owner per ciascuno. Idempotente.
// Login demo:  nino@tako.local / demo12345   —   pizza@tako.local / demo12345
import postgres from 'postgres'
import bcrypt from 'bcryptjs'

const sql = postgres(process.env.DATABASE_URL ?? 'postgresql://tako:tako@localhost:5432/takodb')

const NINO = 'd1b96b1b-e4d4-4a64-bb8f-5f6f36d061fa'
const PIZZA = '96ad8f24-9cf8-45b6-9ff4-ea6d925960ad'
const hash = await bcrypt.hash('demo12345', 12)

const data = [
  { id: NINO, name: 'Trattoria da Nino', slug: 'nino', color: '#5963ee', email: 'nino@tako.local' },
  { id: PIZZA, name: 'Test Pizza', slug: 'test-pizza', color: '#ED7159', email: 'pizza@tako.local' },
]

for (const r of data) {
  await sql`
    insert into restaurants (id, name, slug, primary_color, plan)
    values (${r.id}, ${r.name}, ${r.slug}, ${r.color}, 'pro')
    on conflict (id) do nothing`
  await sql`
    insert into users (restaurant_id, name, email, password_hash, role)
    values (${r.id}, 'Owner', ${r.email}, ${hash}, 'owner')
    on conflict (email) do nothing`
  console.log(`[bootstrap] ${r.name} ok (${r.email} / demo12345)`)
}

await sql.end()
