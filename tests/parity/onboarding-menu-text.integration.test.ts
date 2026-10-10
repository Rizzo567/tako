import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { createRequire } from 'node:module'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { createServer } from 'node:net'
import postgres from 'postgres'

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

describe('onboarding text import HTTP preview', () => {
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
    process.env.WEB_ORIGIN = 'https://test.tako.example'
    const { authRoutes } = await import('../../apps/server/src/routes/auth.js')
    await app.register(authRoutes, { prefix: '/api/auth' })
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




  it('text preview appends locally while DB draft/publication stay unchanged and tenant/revision gates reject', async () => {
    const docA=(await request('GET','/api/menu-workspace/',cookieA)).json()
    const docB=(await request('GET','/api/menu-workspace/',cookieB)).json()
    const before=await sql`select restaurant_id,draft,published,revision,published_revision from menu_workspaces order by restaurant_id`
    const versionsBefore=await sql`select count(*)::int as count from menu_workspace_versions`
    const body={expectedRevision:docA.revision,format:'text',menuId:a.menuId,source:'# Piatti\nNuovo piatto — 9,50 €\nDescrizione controllabile'}
    const preview=await request('POST','/api/menu-workspace/import/preview',cookieA,body)
    expect(preview.statusCode).toBe(200)
    const output=preview.json().data
    expect(output.importedCount).toBe(1)
    const section=output.workspace.menus.find((menu:any)=>menu.id===a.menuId).sections.find((section:any)=>section.id===a.sectionId)
    expect(section.items[0]).toEqual(docA.data.menus[0].sections[0].items[0])
    expect(section.items[1]).toMatchObject({name:'Nuovo piatto',price:9.5,description:'Descrizione controllabile',allergens:[]})
    expect(section.items[1].id).not.toBe(a.itemId)
    expect((await request('POST','/api/menu-workspace/import/preview',cookieA,{...body,menuId:b.menuId})).statusCode).toBe(400)
    expect((await request('POST','/api/menu-workspace/import/preview',cookieB,{...body,expectedRevision:docB.revision})).statusCode).toBe(400)
    expect((await request('POST','/api/menu-workspace/import/preview',cookieA,{...body,expectedRevision:docA.revision+1})).statusCode).toBe(409)
    const malformed=await request('POST','/api/menu-workspace/import/preview',cookieA,{...body,source:'# Piatti\nPrezzo inventato — -5 €'})
    expect(malformed.statusCode).toBe(400)
    expect(await sql`select restaurant_id,draft,published,revision,published_revision from menu_workspaces order by restaurant_id`).toEqual(before)
    expect(await sql`select count(*)::int as count from menu_workspace_versions`).toEqual(versionsBefore)
    expect((await sql`select count(*)::int as count from menu_items`)[0].count).toBe(2)
  })
})
