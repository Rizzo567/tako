import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { createRequire } from 'node:module'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { createServer } from 'node:net'
import postgres from 'postgres'
import { io as connectSocket } from 'socket.io-client'

// Avoid importing index.ts (which starts the whole server). Only its event transport
// is replaced, with the actual Socket.io server created below. Auth/SQL/routes
// remain the production implementations.
const transport = vi.hoisted(() => ({ server: null as any }))
vi.mock('../../apps/server/src/index.js', () => ({
  io: { to: (...args: any[]) => transport.server.to(...args) },
}))

const serverRequire = createRequire(resolve('apps/server/package.json'))
const dbRequire = createRequire(resolve('packages/db/package.json'))
const Fastify = serverRequire('fastify')
const cookie = serverRequire('@fastify/cookie')
const jwt = serverRequire('@fastify/jwt')
const bcrypt = serverRequire('bcryptjs')
const { Server } = serverRequire('socket.io')
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

describe('hosted Tako: real credentials and tenant isolation', () => {
  let temporaryDirectory: string
  let pg: any
  let sql: ReturnType<typeof postgres>
  let app: any
  let socketServer: any
  let url: string
  let a: any
  let b: any
  let cookieA: string
  let cookieB: string
  const savedEnvironment = { ...process.env }
  const sockets: any[] = []
  const deliveries: any[] = []

  async function login(email: string, password: string) {
    return app.inject({ method: 'POST', url: '/api/auth/login', payload: { email, password } })
  }
  function sessionCookie(response: any) {
    const header = response.headers['set-cookie']
    return (Array.isArray(header) ? header[0] : header).split(';')[0]
  }
  const request = (method: string, path: string, session: string, payload?: any) =>
    app.inject({ method, url: path, headers: { cookie: session }, ...(payload ? { payload } : {}) })

  beforeAll(async () => {
    temporaryDirectory = await mkdtemp(join(tmpdir(), 'tako-web-tenant-test-'))
    const port = await freePort()
    pg = new EmbeddedPostgres({ databaseDir: join(temporaryDirectory, 'pg'), port, user: 'isolated_test', password: 'isolated_test', persistent: false, initdbFlags: ['--encoding=UTF8'] })
    await pg.initialise()
    await pg.start()
    await pg.createDatabase('tenant_test')
    process.env.DATABASE_URL = `postgresql://isolated_test:isolated_test@127.0.0.1:${port}/tenant_test`
    process.env.TAKO_MODE = 'web'
    process.env.NODE_ENV = 'production'
    process.env.WEB_ORIGIN = 'https://app.isolated.test'
    // This suite owns a disposable loopback database, not the managed deploy.
    delete process.env.DATABASE_CA_CERT_PATH
    process.env.TAKO_MULTI_TENANT = '1'
    process.env.COOKIE_SECURE = '1'
    process.env.JWT_SECRET = 'isolated-test-secret-with-more-than-32-characters'
    process.env.TAKO_EMAIL_VERIFICATION = '0'
    process.env.TAKO_DISABLE_REGISTRATION = '0'
    delete process.env.CLOUD_BASE_URL
    sql = postgres(process.env.DATABASE_URL, { max: 2 })
    await migrate(drizzle(sql), { migrationsFolder: resolve('packages/db/src/migrations') })

    async function seed(label: string) {
      const [restaurant] = await sql`insert into restaurants(name,slug,plan) values (${label},${`web-isolation-${label.toLowerCase()}`},'pro') returning id`
      const password = `Password-${label}-2026`
      const hash = await bcrypt.hash(password, 4)
      const email = `owner-${label.toLowerCase()}@isolated.test`
      const [owner] = await sql`insert into users(restaurant_id,name,email,role,password_hash,email_verified) values (${restaurant.id},${`Owner ${label}`},${email},'owner',${hash},true) returning id`
      const [table] = await sql`insert into tables(restaurant_id,number,seats,qr_token) values (${restaurant.id},'T1',4,${`isolated-qr-${label}`}) returning id`
      const [menu] = await sql`insert into menus(restaurant_id,name,type,active,position) values (${restaurant.id},${`Menu ${label}`},'main',true,0) returning id`
      const [section] = await sql`insert into menu_sections(menu_id,name,position,active) values (${menu.id},'Piatti',0,true) returning id`
      const [item] = await sql`insert into menu_items(restaurant_id,section_id,name,price,available,position) values (${restaurant.id},${section.id},${`Piatto ${label}`},12,true,0) returning id`
      const [order] = await sql`insert into orders(restaurant_id,table_id,table_number,type,status,total,idempotency_key) values (${restaurant.id},${table.id},'T1','dine_in','pending',12,${`isolation-order-${label}`}) returning id`
      return { id: restaurant.id, ownerId: owner.id, tableId: table.id, menuId: menu.id, sectionId: section.id, itemId: item.id, orderId: order.id, email, password }
    }
    a = await seed('A')
    b = await seed('B')
    app = Fastify()
    await app.register(cookie)
    await app.register(jwt, { secret: process.env.JWT_SECRET })
    socketServer = new Server(app.server)
    transport.server = socketServer
    const { webAccountRoutesWithDelivery } = await import('../../apps/server/src/routes/web-accounts.js')
    await app.register(webAccountRoutesWithDelivery(async (mail) => { deliveries.push(mail); return { id: 'fake-delivery' } }), { prefix: '/api/web-accounts' })
    process.env.WEB_ORIGIN = 'https://test.tako.example'
    const { authRoutes } = await import('../../apps/server/src/routes/auth.js')
    const { staffRoutes } = await import('../../apps/server/src/routes/staff.js')
    const { menuRoutes } = await import('../../apps/server/src/routes/menu.js')
    const { orderRoutes } = await import('../../apps/server/src/routes/orders.js')
    const { setupSocketHandlers } = await import('../../apps/server/src/socket/handlers.js')
    await app.register(authRoutes, { prefix: '/api/auth' })
    await app.register(staffRoutes, { prefix: '/api/staff' })
    await app.register(menuRoutes, { prefix: '/api/menu' })
    await app.register(orderRoutes, { prefix: '/api/orders' })
    setupSocketHandlers(socketServer, app)
    url = await app.listen({ host: '127.0.0.1', port: 0 })
    const responseA = await login(a.email, a.password)
    const responseB = await login(b.email, b.password)
    expect(responseA.statusCode).toBe(200)
    expect(responseB.statusCode).toBe(200)
    cookieA = sessionCookie(responseA)
    cookieB = sessionCookie(responseB)
  }, 60_000)

  afterAll(async () => {
    for (const socket of sockets) socket.disconnect()
    if (socketServer) await new Promise<void>((done) => socketServer.close(() => done()))
    if (app) await app.close()
    if (sql) await sql.end()
    if (pg) await pg.stop()
    if (temporaryDirectory) await rm(temporaryDirectory, { recursive: true, force: true })
    for (const key of Object.keys(process.env)) if (!(key in savedEnvironment)) delete process.env[key]
    Object.assign(process.env, savedEnvironment)
  }, 30_000)


  // 19/10: «Password dimenticata» → email con pulsante «Reimposta la password» (link monouso, 30 minuti) e cambio password da loggato.
  const forgot = (email: string) => app.inject({ method: 'POST', url: '/api/web-accounts/forgot-password', payload: { email } })
  const reset = (token: string, password: string) => app.inject({ method: 'POST', url: '/api/web-accounts/reset-password', payload: { token, password } })
  const check = async (token: string) => (await app.inject({ method: 'POST', url: '/api/web-accounts/reset-check', payload: { token } })).json().data.valid
  const lastToken = () => /reset=([^"&]+)/.exec(deliveries.filter(d => d.subject === 'Reimposta la password Takomenu').at(-1).html)![1]
  it('forgot: risposta identica se l’email non esiste; token solo come hash; nuova richiesta annulla il link precedente; due consumi concorrenti → uno vince; email di conferma', async () => {
    deliveries.length = 0; await sql`delete from web_password_resets`
    const known = await forgot(a.email), unknown = await forgot('missing@isolated.test')
    expect(known.statusCode).toBe(200); expect(known.body).toBe(unknown.body); expect(deliveries).toHaveLength(1)
    expect(deliveries[0].to).toBe(a.email); expect(deliveries[0].html).toContain('Reimposta la password'); expect(deliveries[0].html).toContain('30 minuti')
    const first = lastToken(), rows = await sql`select token_hash from web_password_resets`
    expect(rows[0].token_hash).not.toBe(first); expect(rows[0].token_hash).toHaveLength(64)
    expect(await check(first)).toBe(true)
    await forgot(a.email); const second = lastToken()
    expect(await check(first)).toBe(false); expect((await reset(first, 'Changed-password-2026')).json().error.code).toBe('INVALID_RESET')
    expect(await check(second)).toBe(true); expect(await check('x'.repeat(43))).toBe(false)
    const responses = await Promise.all([1, 2].map(() => reset(second, 'Changed-password-2026')))
    expect(responses.map(r => r.statusCode).sort()).toEqual([200, 400])
    expect(responses.find(r => r.statusCode === 200)!.json().data.email).toBe(a.email)
    expect(await check(second)).toBe(false)
    expect(deliveries.filter(d => d.subject === 'La tua password è stata cambiata').map(d => d.to)).toEqual([a.email])
    expect((await request('GET', '/api/auth/me', cookieA)).statusCode).toBe(401)
    expect((await request('GET', '/api/auth/me', cookieB)).statusCode).toBe(200)
    expect((await login(a.email, a.password)).statusCode).toBe(401)
    expect((await login(a.email, 'Changed-password-2026')).statusCode).toBe(200)
    a.password = 'Changed-password-2026'; cookieA = sessionCookie(await login(a.email, a.password))
  })
  it('link scaduto o già usato → «Link scaduto»; password corta rifiutata; massimo 3 link l’ora', async () => {
    deliveries.length = 0; await sql`delete from web_password_resets`
    await forgot(b.email); const token = lastToken()
    expect((await reset(token, 'corta')).statusCode).toBe(400); expect(await check(token)).toBe(true)
    await sql`update web_password_resets set expires_at=now()-interval '1 minute' where consumed_at is null`
    expect(await check(token)).toBe(false)
    const expired = await reset(token, 'Nuova-password-b-1'); expect(expired.statusCode).toBe(400); expect(expired.json().error.message).toBe('Link scaduto, richiedine uno nuovo.')
    expect((await login(b.email, b.password)).statusCode).toBe(200)
    await forgot(b.email); await forgot(b.email); expect(deliveries).toHaveLength(3)
    expect((await forgot(b.email)).statusCode).toBe(200); expect(deliveries).toHaveLength(3)
  })
  it('cambio password da loggato: serve quella attuale; chiude le altre sessioni, non questa; isolamento tra locali', async () => {
    const change = (session: string, payload: any) => request('POST', '/api/web-accounts/change-password', session, payload)
    expect((await app.inject({ method: 'POST', url: '/api/web-accounts/change-password', payload: { current: b.password, password: 'Altra-password-2026' } })).statusCode).toBe(401)
    const other = sessionCookie(await login(b.email, b.password))
    expect((await change(cookieB, { current: 'sbagliata', password: 'Altra-password-2026' })).json().error.code).toBe('WRONG_PASSWORD')
    expect((await change(cookieB, { current: b.password, password: 'corta' })).statusCode).toBe(400)
    // la sessione di A non può cambiare la password di B (agisce solo sul proprio utente)
    expect((await change(cookieA, { current: b.password, password: 'Altra-password-2026' })).json().error.code).toBe('WRONG_PASSWORD')
    expect((await change(cookieB, { current: b.password, password: 'Altra-password-2026' })).statusCode).toBe(200)
    expect((await request('GET', '/api/auth/me', cookieB)).statusCode).toBe(200)
    expect((await request('GET', '/api/auth/me', other)).statusCode).toBe(401)
    expect((await login(b.email, b.password)).statusCode).toBe(401)
    expect((await login(b.email, 'Altra-password-2026')).statusCode).toBe(200)
    expect((await login(a.email, a.password)).statusCode).toBe(200)
  })
  it('capacity serializes last slots across real concurrent transactions', async () => {
    const { db } = await import('../../packages/db/src/index.js')
    const { lockReservationCapacity, checkReservationCapacity } = await import('../../apps/server/src/lib/reservation-capacity.js')
    const results = await Promise.all([1,2].map(() => db.transaction(async tx => {
      await lockReservationCapacity(tx, a.id)
      const input = { restaurantId: a.id, startsAt: new Date('2030-01-01T18:00:00Z'), partySize: 3, durationMin: 90 }
      const error = await checkReservationCapacity(tx, input)
      if(error) return error.code
      const { reservations } = await import('../../packages/db/src/index.js')
      await tx.insert(reservations).values({ ...input, customerName: 'Test', customerPhone: '000', status: 'confirmed' })
      return 'created'
    })))
    expect(results.sort()).toEqual(['RESERVATION_CAPACITY','created'])
    const error = await checkReservationCapacity(db, { restaurantId: b.id, tableId:b.tableId, startsAt:new Date('2030-01-01T18:00:00Z'),partySize:5,durationMin:90 })
    expect(error?.code).toBe('TABLE_CAPACITY')
  })
  it('durable reminders deliver once and cancellation/consent changes prevent delivery', async () => {
    const { processReservationReminders } = await import('../../apps/server/src/lib/web-mail.js')
    const [booking] = await sql`insert into reservations(restaurant_id,customer_name,customer_phone,party_size,starts_at,status,customer_email,reminder_consent,reminder_revision) values(${b.id},'Test','000',2,'2030-01-01T18:00:00Z','confirmed','fixture@isolated.test',true,1) returning id`
    const key = `reservation:${booking.id}:1`
    await sql`insert into web_mail_outbox(restaurant_id,reservation_id,kind,dedupe_key,recipient,subject,html,scheduled_at) values(${b.id},${booking.id},'reservation_reminder',${key},'fixture@isolated.test','Test','<p>Test</p>','2030-01-01T10:00:00Z')`
    let delivered = 0
    const fake = async () => { delivered++; return { id:'fake-reminder' } }
    expect((await processReservationReminders(fake,new Date('2030-01-01T11:00:00Z'))).sent).toBe(1)
    expect((await processReservationReminders(fake,new Date('2030-01-01T11:00:00Z'))).sent).toBe(0)
    expect(delivered).toBe(1)
    await sql`update reservations set reminder_revision=2,reminder_consent=false where id=${booking.id}`
    await sql`insert into web_mail_outbox(restaurant_id,reservation_id,kind,dedupe_key,recipient,subject,html,scheduled_at) values(${b.id},${booking.id},'reservation_reminder',${`reservation:${booking.id}:2`},'fixture@isolated.test','Test','<p>Test</p>','2030-01-01T10:00:00Z')`
    expect((await processReservationReminders(fake,new Date('2030-01-01T11:00:00Z'))).cancelled).toBe(1)
    expect(delivered).toBe(1)
  })

})
