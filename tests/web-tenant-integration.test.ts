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
vi.mock('../apps/server/src/index.js', () => ({
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
    const { authRoutes } = await import('../apps/server/src/routes/auth.js')
    const { staffRoutes } = await import('../apps/server/src/routes/staff.js')
    const { menuRoutes } = await import('../apps/server/src/routes/menu.js')
    const { orderRoutes } = await import('../apps/server/src/routes/orders.js')
    const { setupSocketHandlers } = await import('../apps/server/src/socket/handlers.js')
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

  it('each password authenticates only its owner and issues a secure HttpOnly session', async () => {
    const good = await login(a.email, a.password)
    expect(good.json().data.restaurant.id).toBe(a.id)
    expect(good.headers['set-cookie']).toMatch(/HttpOnly/)
    expect(good.headers['set-cookie']).toMatch(/Secure/)
    expect((await login(a.email, b.password)).statusCode).toBe(401)
    expect((await request('GET', '/api/auth/me', cookieB)).json().data.restaurantId).toBe(b.id)
    expect((await app.inject('/api/staff/')).statusCode).toBe(401)
  })

  it('menu and staff reads are scoped to the authenticated restaurant', async () => {
    const menus = (await request('GET', '/api/menu/', cookieA)).json().data
    expect(menus.map((menu: any) => menu.id)).toEqual([a.menuId])
    const members = (await request('GET', '/api/staff/', cookieA)).json().data
    expect(members.map((member: any) => member.id)).toEqual([a.ownerId])
    expect((await request('GET', `/api/menu/${b.menuId}`, cookieA)).statusCode).toBe(404)
  })

  it('imported mixed-case owner emails accept normal email casing', async () => {
    await sql`update users set email=${b.email.toUpperCase()} where id=${b.ownerId}`
    const response = await login(b.email, b.password)
    expect(response.statusCode).toBe(200)
    expect(response.json().data.restaurant.id).toBe(b.id)
    expect((await login(a.email.toUpperCase(), a.password)).statusCode).toBe(200)
  })

  it('new owner registration normalizes email and creates an independent restaurant', async () => {
    const response = await app.inject({ method: 'POST', url: '/api/auth/register', payload: {
      restaurantName: 'Restaurant C', restaurantSlug: 'web-isolation-c', name: 'Owner C',
      email: 'Owner-C@ISOLATED.test', password: 'Owner-C-password-2026',
    } })
    expect(response.statusCode).toBe(201)
    expect(response.json().data.user.email).toBe('owner-c@isolated.test')
    const loggedIn = await login('OWNER-C@isolated.test', 'Owner-C-password-2026')
    expect(loggedIn.statusCode).toBe(200)
    expect(loggedIn.json().data.restaurant.id).not.toBe(a.id)
    expect(loggedIn.json().data.restaurant.id).not.toBe(b.id)
    expect((await request('GET', `/api/menu/${a.menuId}`, sessionCookie(loggedIn))).statusCode).toBe(404)
  })

  it('anonymous PIN and roster appliance entry points are unavailable on the web', async () => {
    expect((await app.inject(`/api/auth/pin-roster?restaurantId=${b.id}`)).statusCode).toBe(404)
    expect((await app.inject({ method: 'POST', url: '/api/auth/pin-login', payload: { restaurantId: b.id, userId: b.ownerId, pin: '1234' } })).statusCode).toBe(404)
  })

  it('foreign menu IDs cannot be edited or receive new items', async () => {
    expect((await request('PATCH', `/api/menu/items/${b.itemId}`, cookieA, { name: 'Tampered' })).statusCode).toBe(404)
    expect((await request('POST', `/api/menu/${b.menuId}/sections`, cookieA, { name: 'Tampered' })).statusCode).toBe(404)
    expect((await request('POST', `/api/menu/sections/${b.sectionId}/items`, cookieA, { name: 'Tampered', price: 1 })).statusCode).toBe(404)
    const [row] = await sql`select name from menu_items where id=${b.itemId}`
    expect(row.name).toBe('Piatto B')
  })

  it('foreign users cannot be changed, deactivated, or have sessions revoked', async () => {
    expect((await request('PATCH', `/api/staff/${b.ownerId}`, cookieA, { active: false })).statusCode).toBe(404)
    expect((await request('DELETE', `/api/staff/${b.ownerId}`, cookieA)).statusCode).toBe(404)
    expect((await request('GET', '/api/auth/me', cookieB)).statusCode).toBe(200)
  })

  it('foreign order IDs and table IDs cannot cross tenant boundaries', async () => {
    const rows = (await request('GET', '/api/orders/active', cookieA)).json().data
    expect(rows.map((order: any) => order.id)).toEqual([a.orderId])
    expect((await request('PATCH', `/api/orders/${b.orderId}/status`, cookieA, { status: 'confirmed' })).statusCode).toBe(404)
    const response = await request('POST', '/api/orders/', cookieA, { tableId: b.tableId, type: 'dine_in', items: [{ menuItemId: a.itemId, quantity: 1 }] })
    expect(response.statusCode).toBeGreaterThanOrEqual(400)
    const [row] = await sql`select status from orders where id=${b.orderId}`
    expect(row.status).toBe('pending')
  })

  it('web staff require their own password and password rotation revokes existing sessions', async () => {
    const payload = { name: 'Waiter A', email: 'waiter-a@isolated.test', role: 'dipendente', pin: '1234' }
    expect((await request('POST', '/api/staff/', cookieA, payload)).statusCode).toBe(400)
    const created = await request('POST', '/api/staff/', cookieA, { ...payload, password: 'Waiter-password-2026' })
    expect(created.statusCode).toBe(201)
    expect(created.json().data.passwordHash).toBeUndefined()
    const staffId = created.json().data.id
    const loggedIn = await login(payload.email, 'Waiter-password-2026')
    expect(loggedIn.statusCode).toBe(200)
    expect(loggedIn.json().data.restaurant.id).toBe(a.id)
    const waiterCookie = sessionCookie(loggedIn)
    expect((await request('POST', '/api/staff/', waiterCookie, { ...payload, email: 'new@isolated.test' })).statusCode).toBe(403)
    expect((await request('PATCH', `/api/staff/${staffId}`, cookieA, { password: 'Replacement-password-2026' })).statusCode).toBe(200)
    expect((await request('GET', '/api/auth/me', waiterCookie)).statusCode).toBe(401)
    expect((await login(payload.email, 'Waiter-password-2026')).statusCode).toBe(401)
    expect((await login(payload.email, 'Replacement-password-2026')).statusCode).toBe(200)
  })

  it('a staff socket cannot join another restaurant room', async () => {
    const socket = connectSocket(url, { transports: ['websocket'], extraHeaders: { cookie: cookieA }, reconnection: false })
    sockets.push(socket)
    await new Promise<void>((done, reject) => { socket.once('connect', done); socket.once('connect_error', reject) })
    socket.emit('join:restaurant', a.id)
    const waitUntil = async (condition: () => boolean) => {
      for (let i = 0; i < 50; i++) { if (condition()) return; await new Promise((done) => setTimeout(done, 20)) }
      throw new Error('socket room membership was not established')
    }
    await waitUntil(() => socketServer.sockets.adapter.rooms.get(`restaurant:${a.id}`)?.has(socket.id))
    socket.emit('join:restaurant', b.id)
    // A same-connection marker ensures the join request has reached the server.
    await new Promise<void>((done) => { socketServer.sockets.sockets.get(socket.id).once('test:processed', done); socket.emit('test:processed') })
    await new Promise((done) => setTimeout(done, 100))
    expect(socketServer.sockets.adapter.rooms.get(`restaurant:${b.id}`)?.has(socket.id) ?? false).toBe(false)
    const received: string[] = []
    socket.on('test:tenant', (label: string) => received.push(label))
    socketServer.to(`restaurant:${b.id}`).emit('test:tenant', 'B')
    socketServer.to(`restaurant:${a.id}`).emit('test:tenant', 'A')
    await waitUntil(() => received.length > 0)
    expect(received).toEqual(['A'])
  })

  it('owner password reset removes the imported appliance secret and revokes prior sessions', async () => {
    const legacySecret = 'Legacy-appliance-password-2026'
    const hash = await bcrypt.hash(legacySecret, 4)
    await sql`update users set local_owner_secret_hash=${hash} where id=${a.ownerId}`
    expect((await login(a.email, legacySecret)).statusCode).toBe(200)
    expect((await request('PATCH', `/api/staff/${a.ownerId}`, cookieB, { password: 'Foreign-reset-password-2026' })).statusCode).toBe(404)
    expect((await request('PATCH', `/api/staff/${a.ownerId}`, cookieA, { password: 'New-owner-password-2026' })).statusCode).toBe(200)
    expect((await request('GET', '/api/auth/me', cookieA)).statusCode).toBe(401)
    expect((await login(a.email, legacySecret)).statusCode).toBe(401)
    expect((await login(a.email, a.password)).statusCode).toBe(401)
    expect((await login(a.email, 'New-owner-password-2026')).statusCode).toBe(200)
    const [row] = await sql`select local_owner_secret_hash from users where id=${a.ownerId}`
    expect(row.local_owner_secret_hash).toBeNull()
  })

  it('the AI staff action cannot bypass personal web credentials', async () => {
    const { executeAction } = await import('../apps/server/src/lib/ai-actions.js')
    const [before] = await sql`select count(*)::int as count from users where restaurant_id=${a.id}`
    const result = await executeAction('create_staff', { name: 'AI Waiter', role: 'dipendente', pin: '1234' },
      { restaurantId: a.id, role: 'owner' }, 'owner', { allowMutation: true })
    expect(result.ok).toBe(false)
    const [after] = await sql`select count(*)::int as count from users where restaurant_id=${a.id}`
    expect(after.count).toBe(before.count)
    const phantom = await sql`select id from users where restaurant_id=${a.id} and name='AI Waiter'`
    expect(phantom).toHaveLength(0)
  })
})
