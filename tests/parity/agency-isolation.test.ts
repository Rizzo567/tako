import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { createRequire } from 'node:module'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { createServer } from 'node:net'
import postgres from 'postgres'
import { io as connectSocket } from 'socket.io-client'

// Avoid importing index.ts (which boots an appliance). Only its event transport
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
    const { webLocationRoutes } = await import('../../apps/server/src/routes/web-locations.js')
    await app.register(webLocationRoutes,{prefix:'/api/web-locations'})
    const { billRoutes } = await import('../../apps/server/src/routes/bills.js')
    const { statsRoutes } = await import('../../apps/server/src/routes/stats.js')
    await app.register(billRoutes,{prefix:'/api/bills'})
    await app.register(statsRoutes,{prefix:'/api/stats'})
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




  it('agency editor scope edits only assigned menu and cannot join operational staff room; revocation is immediate', async () => {
    expect((await request('POST','/api/web-locations/members',cookieA,{email:b.email,role:'menu_editor'})).statusCode).toBe(200)
    expect((await request('POST','/api/web-locations/switch',cookieB,{restaurantId:a.id})).statusCode).toBe(200)
    const me=(await request('GET','/api/auth/me',cookieB)).json().data
    expect(me.restaurantId).toBe(a.id); expect(me.role).toBe('menu_editor')
    const workspace=(await request('GET','/api/menu-workspace/',cookieB)).json()
    workspace.data.menus[0].name='Agency edit'
    expect((await request('PUT','/api/menu-workspace/',cookieB,{expectedRevision:workspace.revision,workspace:workspace.data})).statusCode).toBe(200)
    for(const path of ['/api/orders/active','/api/bills/','/api/stats/dashboard','/api/staff/']) expect((await request('GET',path,cookieB)).statusCode).toBe(403)
    const socket=connectSocket(url,{transports:['websocket'],extraHeaders:{cookie:cookieB},reconnection:false});sockets.push(socket)
    await new Promise<void>((done,reject)=>{socket.once('connect',done);socket.once('connect_error',reject)})
    socket.emit('join:restaurant',a.id)
    await new Promise(done=>setTimeout(done,100))
    expect(socketServer.sockets.adapter.rooms.get(`restaurant:${a.id}`)?.has(socket.id)??false).toBe(false)
    expect((await request('DELETE',`/api/web-locations/members/${b.ownerId}`,cookieA)).statusCode).toBe(200)
    expect((await request('GET','/api/menu-workspace/',cookieB)).statusCode).toBe(401)
  })
  it('owner switches to a second owned location while menu data stay isolated', async () => {
    const created=await request('POST','/api/web-locations/',cookieA,{name:'Second location',slug:'second-location-test'})
    expect(created.statusCode).toBe(200)
    const secondId=created.json().data.id
    expect((await request('POST','/api/web-locations/switch',cookieA,{restaurantId:b.id})).statusCode).toBe(404)
    expect((await request('POST','/api/web-locations/switch',cookieA,{restaurantId:secondId})).statusCode).toBe(200)
    const workspace=(await request('GET','/api/menu-workspace/',cookieA)).json()
    expect(workspace.data.menus[0].name).toBe('Menu')
    expect((await request('GET','/api/menu/',cookieA)).json().data.every((menu:any)=>menu.restaurantId===secondId)).toBe(true)
    expect((await request('POST','/api/web-locations/switch',cookieA,{restaurantId:a.id})).statusCode).toBe(200)
    expect((await request('GET','/api/menu-workspace/',cookieA)).json().data.menus[0].name).toBe('Agency edit')
  })
  it('public helper exposes published content only, honors schedules and live sold-out state', async () => {
    const { publishedMenu } = await import('../../apps/server/src/lib/published-menu.js')
    const [row] = await sql`select draft,published from menu_workspaces where restaurant_id=${a.id}`
    const draft=structuredClone(row.draft)
    draft.menus[0].name='Private draft title'
    await sql`update menu_workspaces set draft=${JSON.stringify(draft)}::jsonb where restaurant_id=${a.id}`
    expect((await publishedMenu(a.id))!.menus[0].name).not.toBe('Private draft title')
    expect((await publishedMenu(a.id))!.menus[0].sections[0].items.some(item=>item.id===a.itemId)).toBe(true)
    await sql`update menu_items set available=false where id=${a.itemId}`
    expect((await publishedMenu(a.id))!.menus[0].sections[0].items).toHaveLength(0)
    await sql`update menu_items set available=true where id=${a.itemId}`
    const published=structuredClone(row.published)
    published.menus[0].schedule={enabled:true,timezone:'Europe/Rome',from:'2099-01-01',until:null,windows:[{weekdays:[0,1,2,3,4,5,6],start:'00:00',end:'00:00'}]}
    await sql`update menu_workspaces set published=${JSON.stringify(published)}::jsonb where restaurant_id=${a.id}`
    expect((await publishedMenu(a.id))!.menus).toHaveLength(0)
  })

})
