import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { randomUUID } from 'node:crypto'
import { createRequire } from 'node:module'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { createServer } from 'node:net'
import postgres from 'postgres'

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

describe('extended menu controls HTTP persistence', () => {
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




  it('legacy DTO and extended controls persist; stale revisions and foreign PDF asset cannot change the draft', async () => {
    const original=(await request('GET','/api/menu-workspace/',cookieA)).json()
    const legacy=structuredClone(original.data)
    legacy.design.primary='#193847';legacy.design.categoryBackground='#223344'
    legacy.design.standard.name={fontSize:21,color:'#445566',bold:true,italic:false,align:'left'}
    legacy.pdf={font:'serif',columns:2,showQr:false}
    const first=await request('PUT','/api/menu-workspace/',cookieA,{expectedRevision:original.revision,workspace:legacy})
    expect(first.statusCode).toBe(200)
    const doc=(await request('GET','/api/menu-workspace/',cookieA)).json()
    expect(doc.data.design.primary).toBe('#193847');expect(doc.data.design.standard.name).toMatchObject({fontSize:21,color:'#445566',bold:true})
    expect(doc.data.pdf).toMatchObject({font:'serif',columns:2,showQr:false,showPrices:true})
    const extended=structuredClone(doc.data)
    Object.assign(extended.design,{imageWidth:137,imageHeight:91,centeredItemGap:38,dividerColor:'#789abc',backgroundOverlayOpacity:.35,menuPosition:'bottom',subcategoryStyle:{background:'#123456',borderWidth:3,borderColor:'#987654',borderRadius:17},categoryTitleStyle:{font:'mono',fontSize:27,underline:true,color:'#345678'},standard:{...extended.design.standard,name:{...extended.design.standard.name,font:'serif',underline:true}}})
    Object.assign(extended.pdf,{verticalCentered:true,backgroundImageUrl:`/uploads/${a.id}/aaaaaaaaaaaaaaaa.png`,backgroundOpacity:.42,logoBackground:'#223344',typography:{name:{font:'serif',fontSize:17,color:'#123456',bold:false,underline:true},price:{font:'mono',fontSize:13,color:'#654321'}},spaces:{item:{top:18,right:9,bottom:14,left:7}},legends:{allergens:false,traits:true,additives:true},translationActive:true,translationNamesPolicy:'auto'})
    const saved=await request('PUT','/api/menu-workspace/',cookieA,{expectedRevision:doc.revision,workspace:extended})
    expect(saved.statusCode).toBe(200)
    const roundtrip=(await request('GET','/api/menu-workspace/',cookieA)).json()
    expect(roundtrip.data.design).toMatchObject({imageWidth:137,imageHeight:91,centeredItemGap:38,dividerColor:'#789abc',backgroundOverlayOpacity:.35,menuPosition:'bottom',categoryTitleStyle:{font:'mono',fontSize:27,underline:true},subcategoryStyle:{borderRadius:17},standard:{name:{font:'serif',underline:true}}})
    expect(roundtrip.data.pdf).toMatchObject(extended.pdf)
    const before=await sql`select draft,published,revision,published_revision from menu_workspaces where restaurant_id=${a.id}`
    expect((await request('PUT','/api/menu-workspace/',cookieA,{expectedRevision:doc.revision,workspace:extended})).statusCode).toBe(409)
    const foreign=structuredClone(roundtrip.data);foreign.pdf.backgroundImageUrl=`/uploads/${b.id}/bbbbbbbbbbbbbbbb.png`
    expect((await request('PUT','/api/menu-workspace/',cookieA,{expectedRevision:roundtrip.revision,workspace:foreign})).statusCode).toBe(404)
    const absolute=structuredClone(roundtrip.data);absolute.pdf.backgroundImageUrl=`https://test.tako.example/uploads/${b.id}/bbbbbbbbbbbbbbbb.png`
    expect((await request('PUT','/api/menu-workspace/',cookieA,{expectedRevision:roundtrip.revision,workspace:absolute})).statusCode).toBe(404)
    const preset=structuredClone(roundtrip.data);preset.pdfPresets=[{id:randomUUID(),name:'Foreign background',config:{...preset.pdf,backgroundImageUrl:`/uploads/${b.id}/bbbbbbbbbbbbbbbb.png`}}]
    expect((await request('PUT','/api/menu-workspace/',cookieA,{expectedRevision:roundtrip.revision,workspace:preset})).statusCode).toBe(404)
    expect(await sql`select draft,published,revision,published_revision from menu_workspaces where restaurant_id=${a.id}`).toEqual(before)
    expect(before[0].published).toEqual(original.data)
    const other=(await request('GET','/api/menu-workspace/',cookieB)).json()
    expect(other.data.design.imageWidth).toBeUndefined();expect(other.data.pdf.backgroundImageUrl).toBeNull()
    const oldId=randomUUID(),oldSnapshot={schemaVersion:1,menus:legacy.menus,design:{primary:'#193847',categoryBackground:'#223344',standard:legacy.design.standard},pdf:{font:'serif',columns:2,showQr:false}}
    await sql`insert into menu_workspace_versions(id,restaurant_id,revision,label,snapshot) values (${oldId},${a.id},1,'Pre-extension fixture',${JSON.stringify(oldSnapshot)}::jsonb)`
    expect((await request('POST',`/api/menu-workspace/versions/${oldId}/restore`,cookieA,{expectedRevision:doc.revision})).statusCode).toBe(409)
    const restored=await request('POST',`/api/menu-workspace/versions/${oldId}/restore`,cookieA,{expectedRevision:roundtrip.revision})
    expect(restored.statusCode).toBe(200);expect(restored.json().revision).toBeGreaterThan(roundtrip.revision)
    const latest=(await request('GET','/api/menu-workspace/',cookieA)).json()
    expect(latest.data.design.primary).toBe('#193847');expect(latest.data.design.standard.name).toMatchObject({fontSize:21,color:'#445566',bold:true})
    expect(latest.data.pdf).toMatchObject({font:'serif',columns:2,showPrices:true})
    expect((await sql`select published from menu_workspaces where restaurant_id=${a.id}`)[0].published).toEqual(original.data)
  })
  it('public projection preserves subcategory identity and translated section description for renderer controls',async()=>{
    const {publicMenuProjection}=await import('../../apps/server/src/lib/published-menu.js')
    const current=(await request('GET','/api/menu-workspace/',cookieA)).json().data.menus[0]
    const menu=structuredClone(current),root=menu.sections[0]
    menu.sections.push({...structuredClone(root),id:randomUUID(),parentSectionId:root.id,name:'Child section',description:'Original description',translations:{en:{name:'Translated child',description:'Translated section description'}}})
    const projected=publicMenuProjection(menu,'en')
    expect(projected.sections[1]).toMatchObject({parentSectionId:root.id,name:'Translated child',description:'Translated section description'})
  })

})
