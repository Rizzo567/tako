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
    await app.register(menuWorkspaceRoutes, { prefix: '/api/workspace' })
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



  it('staff consent/status/edit enqueues revised reminders without delivery', async () => {
    const created = await request('POST','/api/reservations/',cookieA,{ customerName:'Fixture',customerPhone:'000',customerEmail:'fixture@isolated.test',reminderConsent:true,startsAt:'2030-01-01T18:00:00Z',partySize:2,status:'confirmed' })
    expect(created.statusCode).toBe(201)
    const id=created.json().data.id
    expect((await sql`select count(*)::int as count from web_mail_outbox where reservation_id=${id} and status='pending'`)[0].count).toBe(1)
    expect((await request('PATCH',`/api/reservations/${id}`,cookieA,{startsAt:'2030-01-02T18:00:00Z'})).statusCode).toBe(200)
    expect((await sql`select count(*)::int as count from web_mail_outbox where reservation_id=${id} and status='pending'`)[0].count).toBe(1)
    expect((await request('PATCH',`/api/reservations/${id}/status`,cookieA,{status:'cancelled'})).statusCode).toBe(200)
    expect((await sql`select count(*)::int as count from web_mail_outbox where reservation_id=${id} and status='pending'`)[0].count).toBe(0)
    expect(deliveries).toHaveLength(0)
  })
  it('draft save is separate from publication, stale revisions conflict and foreign IDs fail closed', async () => {
    const initial=(await request('GET','/api/workspace/',cookieA)).json()
    const draft=structuredClone(initial.data)
    draft.menus[0].name='Draft change'
    const saved=await request('PUT','/api/workspace/',cookieA,{expectedRevision:initial.revision,workspace:draft})
    expect(saved.statusCode).toBe(200)
    const [row]=await sql`select draft,published,revision from menu_workspaces where restaurant_id=${a.id}`
    expect(row.draft.menus[0].name).toBe('Draft change')
    expect(row.published.menus[0].name).not.toBe('Draft change')
    expect((await request('PUT','/api/workspace/',cookieA,{expectedRevision:initial.revision,workspace:draft})).statusCode).toBe(409)
    expect((await request('POST','/api/workspace/publish',cookieA,{expectedRevision:row.revision})).statusCode).toBe(200)
    const foreign=(await request('GET','/api/workspace/',cookieB)).json().data
    const current=(await request('GET','/api/workspace/',cookieA)).json()
    expect((await request('PUT','/api/workspace/',cookieA,{expectedRevision:current.revision,workspace:foreign})).statusCode).toBe(404)
  })
  it('version restore is tenant scoped and creates a new revision; referenced gallery asset cannot be deleted', async () => {
    const current=(await request('GET','/api/workspace/',cookieA)).json()
    const saved=await request('POST','/api/workspace/versions',cookieA,{expectedRevision:current.revision,label:'Before change'})
    expect(saved.statusCode).toBe(200)
    const version=(await request('GET','/api/workspace/versions',cookieA)).json().data[0]
    expect((await request('POST',`/api/workspace/versions/${version.id}/restore`,cookieB,{expectedRevision:1})).statusCode).toBe(404)
    const changed=(await request('GET','/api/workspace/',cookieA)).json()
    changed.data.menus[0].name='Temporary edit'
    expect((await request('PUT','/api/workspace/',cookieA,{expectedRevision:changed.revision,workspace:changed.data})).statusCode).toBe(200)
    const revision=(await request('GET','/api/workspace/',cookieA)).json().revision
    expect((await request('POST',`/api/workspace/versions/${version.id}/restore`,cookieA,{expectedRevision:revision})).statusCode).toBe(200)
    expect((await request('GET','/api/workspace/',cookieA)).json().data.menus[0].name).toBe('Draft change')
    const imageUrl=`/uploads/${a.id}/fixture.jpg`
    const [asset]=await sql`insert into menu_workspace_assets(id,restaurant_id,url,name,bytes,mime) values(gen_random_uuid(),${a.id},${imageUrl},'fixture',10,'image/jpeg') returning id`
    await sql`update menu_items set image_url=${imageUrl} where id=${a.itemId}`
    expect((await request('DELETE',`/api/workspace/assets/${asset.id}`,cookieA)).statusCode).toBe(409)
    expect((await request('DELETE',`/api/workspace/assets/${asset.id}`,cookieB)).statusCode).toBe(404)
  })
  it('staff local clock uses restaurant timezone and rejects DST gaps', async () => {
    const created=await request('POST','/api/reservations/',cookieB,{customerName:'Fixture',customerPhone:'000',partySize:2,localDate:'2026-03-29',localTime:'19:00'})
    expect(created.statusCode).toBe(201)
    expect(created.json().data.startsAt).toBe('2026-03-29T17:00:00.000Z')
    const id=created.json().data.id
    const edited=await request('PATCH',`/api/reservations/${id}`,cookieB,{localDate:'2026-10-25',localTime:'19:00'})
    expect(edited.statusCode).toBe(200)
    expect(edited.json().data.startsAt).toBe('2026-10-25T18:00:00.000Z')
    expect((await request('PATCH',`/api/reservations/${id}`,cookieB,{localDate:'2026-03-29',localTime:'02:30'})).statusCode).toBe(400)
    expect((await request('PATCH',`/api/reservations/${id}`,cookieB,{localDate:'2026-10-25',localTime:'02:30'})).statusCode).toBe(400)
  })

})
