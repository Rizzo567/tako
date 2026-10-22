import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { createRequire } from 'node:module'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { createServer } from 'node:net'
import postgres from 'postgres'

// 21/10: due numeri WhatsApp del titolare per locale su Postgres VERO (DB usa e getta in loopback, mai Supabase).
// Applica gli SQL serverless del WhatsApp nell'ordine in cui sono andati online, poi la migrazione del 21/10, e prova le route reali.
// Solo l'autenticazione è sostituita (utente nell'header), i permessi del locale li verifica il server come in produzione.
vi.mock('../../apps/server/src/index.js', () => ({ io: { to: () => ({ emit: () => {} }) } }))
vi.mock('../../apps/server/src/middleware/auth.js', () => ({
  requireRole: (..._roles: string[]) => async (req: any, reply: any) => {
    const [id, restaurantId] = String(req.headers['x-test-user'] || '').split('|')
    if (!id) return reply.code(401).send({ error: { code: 'UNAUTHORIZED' } })
    req.user = { id, restaurantId, role: 'owner' }
  },
  requireAuth: async () => {},
}))

const serverRequire = createRequire(resolve('apps/server/package.json'))
const dbRequire = createRequire(resolve('packages/db/package.json'))
const Fastify = serverRequire('fastify')
const EmbeddedPostgres = dbRequire('embedded-postgres').default
const { drizzle } = dbRequire('drizzle-orm/postgres-js')
const { migrate } = dbRequire('drizzle-orm/postgres-js/migrator')

async function freePort() {
  const server = createServer()
  await new Promise<void>((done, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', done) })
  const port = (server.address() as { port: number }).port
  await new Promise<void>((done) => server.close(() => done()))
  return port
}

describe('WhatsApp del titolare: due numeri per locale su Postgres vero', () => {
  let dir: string, pg: any, sql: ReturnType<typeof postgres>, app: any
  const saved = { ...process.env }
  let tenant = '', other = '', owner = '', ownerOther = ''
  const as = (user: string, restaurant: string) => ({ 'x-test-user': user + '|' + restaurant })
  const save = (phone: string, email: string, extra: Record<string, unknown> = {}) => app.inject({ method: 'POST', url: '/api/menu-workspace/whatsapp/owner', headers: as(owner, tenant), payload: { phone, email, ...extra } })
  const state = async () => (await app.inject({ method: 'GET', url: '/api/menu-workspace/whatsapp/owner', headers: as(owner, tenant) })).json().data
  // I file serverless hanno BEGIN/COMMIT propri: connessione singola dedicata.
  const applySql = async (name: string) => { const one = postgres(process.env.DATABASE_URL!, { max: 1, onnotice: () => {} }); try { await one.unsafe(await readFile(resolve('scripts/serverless', name), 'utf8')) } finally { await one.end({ timeout: 1 }) } }

  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), 'tako-wa-two-numbers-'))
    const port = await freePort()
    pg = new EmbeddedPostgres({ databaseDir: join(dir, 'pg'), port, user: 'wa_test', password: 'wa_test', persistent: false, initdbFlags: ['--encoding=UTF8'], onLog: () => {} })
    await pg.initialise(); await pg.start(); await pg.createDatabase('wa_test')
    process.env.DATABASE_URL = `postgresql://wa_test:wa_test@127.0.0.1:${port}/wa_test`
    delete process.env.DATABASE_CA_CERT_PATH
    process.env.TWILIO_WHATSAPP_NUMBER = 'whatsapp:+18382622788'
    process.env.TWILIO_AUTH_TOKEN = 'token-di-prova'
    process.env.TAKOMENU_AGENCY_USER_IDS = ''
    sql = postgres(process.env.DATABASE_URL, { max: 2, onnotice: () => {} })
    await migrate(drizzle(sql), { migrationsFolder: resolve('packages/db/src/migrations') })
    await sql.unsafe(`DO $$BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='takomenu_runtime') THEN CREATE ROLE takomenu_runtime; END IF; IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon; END IF; IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated; END IF; END$$`)
    for (const name of ['whatsapp-menu.sql', 'whatsapp-owner-link.sql', 'owner-dashboard-access.sql', 'owner-password-delivery.sql']) await applySql(name)
    const [r1] = await sql`insert into restaurants(name,slug,plan) values ('Locale Uno','wa-uno','pro') returning id`
    const [r2] = await sql`insert into restaurants(name,slug,plan) values ('Locale Due','wa-due','pro') returning id`
    tenant = r1!.id; other = r2!.id
    const [u1] = await sql`insert into users(restaurant_id,name,email,role,password_hash,email_verified) values (${tenant},'Titolare Uno','uno@example.com','owner','x',true) returning id`
    const [u2] = await sql`insert into users(restaurant_id,name,email,role,password_hash,email_verified) values (${other},'Titolare Due','due@example.com','owner','x',true) returning id`
    owner = u1!.id; ownerOther = u2!.id
    const { twilioMenuRoutes } = await import('../../apps/server/src/routes/twilio-menu.js')
    app = Fastify(); await app.register(twilioMenuRoutes, { prefix: '/api' }); await app.ready()
  }, 120000)

  afterAll(async () => {
    await app?.close(); await sql?.end({ timeout: 1 }); await pg?.stop(); await rm(dir, { recursive: true, force: true })
    process.env = saved
  })

  it('prima della migrazione: il secondo numero dà un errore chiaro, il primo resta', async () => {
    expect((await save('3330000091', 'a@example.com')).statusCode).toBe(200)
    const second = await save('3330000092', 'b@example.com')
    expect(second.statusCode).toBe(409)
    expect(second.json().error.code).toBe('SECOND_NUMBER_UNAVAILABLE')
    expect((await state()).numbers.map((n: any) => n.phone)).toEqual(['+393330000091'])
  })

  it('migrazione idempotente; poi tre numeri sì (22/10), il quarto no; scollega uno lascia l’altro', async () => {
    await applySql('whatsapp-owner-two-numbers.sql'); await applySql('whatsapp-owner-two-numbers.sql')
    const indexes = (await sql`select indexname from pg_indexes where tablename='tako_whatsapp_links'`).map(r => r.indexname)
    expect(indexes).not.toContain('tako_whatsapp_links_one_per_restaurant')
    expect(indexes).toContain('tako_whatsapp_links_restaurant')
    expect((await save('3330000092', 'b@example.com')).statusCode).toBe(200)
    expect((await save('3330000093', 'c@example.com')).statusCode).toBe(200)
    const fourth = await save('3330000094', 'd@example.com')
    expect(fourth.statusCode).toBe(409); expect(fourth.json().error.code).toBe('OWNER_PHONES_LIMIT')
    expect((await state()).numbers.map((n: any) => [n.phone, n.email, n.status])).toEqual([['+393330000091', 'a@example.com', 'pending'], ['+393330000092', 'b@example.com', 'pending'], ['+393330000093', 'c@example.com', 'pending']])
    // proposte per telefono: scollegare il primo cancella solo le sue
    await sql`insert into tako_whatsapp_proposals(phone,restaurant_id,actor_id,revision,command,expires_at) values ('whatsapp:+393330000091',${tenant},${owner},1,'{}'::jsonb,now()+interval '1 hour'),('whatsapp:+393330000092',${tenant},${owner},1,'{}'::jsonb,now()+interval '1 hour')`
    expect((await app.inject({ method: 'DELETE', url: '/api/menu-workspace/whatsapp/owner', headers: as(owner, tenant) })).statusCode).toBe(400)
    const r = await app.inject({ method: 'DELETE', url: '/api/menu-workspace/whatsapp/owner?phone=%2B393330000091', headers: as(owner, tenant) })
    expect(r.statusCode).toBe(200)
    expect(r.json().data.numbers.map((n: any) => n.phone)).toEqual(['+393330000092', '+393330000093'])
    expect((await sql`select phone from tako_whatsapp_proposals order by phone`).map(x => x.phone)).toEqual(['whatsapp:+393330000092'])
  })

  it('Modifica sostituisce solo quella riga; un telefono resta su un solo locale', async () => {
    expect((await save('3330000094', 'd@example.com')).statusCode).toBe(200)
    const edit = await save('3330000095', 'd@example.com', { replace: '+393330000094' })
    expect(edit.statusCode).toBe(200); expect(edit.json().data.replacedPhones).toEqual(['+393330000094'])
    expect((await state()).numbers.map((n: any) => n.phone)).toEqual(['+393330000092', '+393330000095'])
    // il titolare di un altro locale non può prendersi un numero già collegato qui
    const steal = await app.inject({ method: 'POST', url: '/api/menu-workspace/whatsapp/owner', headers: as(ownerOther, other), payload: { phone: '3330000092', email: 'e@example.com', move: true } })
    expect(steal.statusCode).toBe(409); expect(steal.json().error.code).toBe('PHONE_IN_USE')
    expect((await sql`select restaurant_id from tako_whatsapp_links where phone='whatsapp:+393330000092'`)[0]!.restaurant_id).toBe(tenant)
  })
})
