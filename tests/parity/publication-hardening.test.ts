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
    const { menuWorkspaceRoutes } = await import('../../apps/server/src/routes/menu-workspace.js')
    const { readFile } = await import('node:fs/promises')
    await sql.unsafe(await readFile('docs/webapp/parity/menu-workspace.sql','utf8'))
    await app.register(menuWorkspaceRoutes, { prefix: '/api/menu-workspace' })
    const { customerRoutes } = await import('../../apps/server/src/routes/customer.js')
    await app.register(customerRoutes,{prefix:'/api/customer'})
    const { reservationRoutes } = await import('../../apps/server/src/routes/reservations.js')
    await app.register(reservationRoutes, { prefix: '/api/reservations' })
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




  it('design publication preserves a live sold-out flag until explicit editorial override', async () => {
    await request('GET','/api/menu-workspace/',cookieA)
    await sql`update menu_items set available=false where id=${a.itemId}`
    const current=(await request('GET','/api/menu-workspace/',cookieA)).json()
    expect(current.data.menus[0].sections[0].items[0].available).toBe(true)
    current.data.design.headerTitle='Only design changed'
    const saved=await request('PUT','/api/menu-workspace/',cookieA,{expectedRevision:current.revision,workspace:current.data})
    expect(saved.statusCode).toBe(200)
    expect((await request('POST','/api/menu-workspace/publish',cookieA,{expectedRevision:saved.json().revision})).statusCode).toBe(200)
    expect((await sql`select available from menu_items where id=${a.itemId}`)[0].available).toBe(false)
    const override=(await request('GET','/api/menu-workspace/',cookieA)).json()
    override.data.menus[0].sections[0].items[0].available=true
    override.data.menus[0].sections[0].items[0].kitchenStation='grill'
    const changed=await request('PUT','/api/menu-workspace/',cookieA,{expectedRevision:override.revision,workspace:override.data})
    expect((await request('POST','/api/menu-workspace/publish',cookieA,{expectedRevision:changed.json().revision})).statusCode).toBe(200)
    const [item]=await sql`select available,kitchen_station from menu_items where id=${a.itemId}`
    expect(item.available).toBe(true);expect(item.kitchen_station).toBe('grill')
  })
  it('anonymous menu requests deduplicate same-visit analytics, record language and serve QR PNG', async () => {
    const first=await app.inject(`/api/customer/restaurant/${a.id}/menu`)
    expect(first.statusCode).toBe(200)
    const header=first.headers['set-cookie'];const visitCookie=(Array.isArray(header)?header[0]:header).split(';')[0]
    for(let i=0;i<3;i++) expect((await request('GET',`/api/customer/restaurant/${a.id}/menu`,visitCookie)).statusCode).toBe(200)
    const rows=await sql`select kind,count(*)::int as count from menu_workspace_events where restaurant_id=${a.id} group by kind`
    expect(rows.find(r=>r.kind==='scan')?.count).toBe(1)
    expect(rows.find(r=>r.kind==='language')?.count).toBe(1)
    const qr=await request('GET','/api/menu-workspace/qr?format=png',cookieA)
    expect(qr.statusCode).toBe(200)
    expect(qr.headers['content-type']).toContain('image/png')
    expect([...qr.rawPayload.subarray(0,8)]).toEqual([137,80,78,71,13,10,26,10])
    const customer=await app.inject(`/api/customer/table/isolated-qr-A`)
    const cookieHeader=customer.headers['set-cookie'];const customerCookie=(Array.isArray(cookieHeader)?cookieHeader[0]:cookieHeader).split(';')[0]
    const order=await request('POST','/api/customer/orders',customerCookie,{restaurantId:a.id,items:[{menuItemId:a.itemId,quantity:1}],idempotencyKey:'public-grill-test'})
    expect(order.statusCode).toBeLessThan(300)
    expect((await sql`select kitchen_station from order_items where order_id=${order.json().data.id}`)[0].kitchen_station).toBe('grill')
  })
})
