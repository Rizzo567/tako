import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Fastify from '../apps/server/node_modules/fastify/fastify.js'
const mocks = vi.hoisted(() => ({ execute: vi.fn(), transaction: vi.fn(), select: vi.fn(), enqueue: vi.fn(), process: vi.fn(), welcome: vi.fn(), agency: false, user: null as any }))
vi.mock('../packages/db/src/index.ts', async importOriginal => ({ ...await importOriginal<any>(), db: mocks }))
vi.mock('../apps/server/src/middleware/auth.js', () => ({ requireAuth: async (req: any, reply: any) => { if (!mocks.user) return reply.code(401).send({ error: { code: 'UNAUTHORIZED' } }); req.user=mocks.user } }))
vi.mock('../apps/server/src/lib/agency-access.js', () => ({ isAgencyUser: () => mocks.agency }))
vi.mock('../apps/server/src/lib/transactional-email/outbox.js', () => ({ enqueueEmail: mocks.enqueue, processEmailOutbox: mocks.process }))
vi.mock('../apps/server/src/lib/transactional-email/welcome.js', () => ({ materializeWelcomeEmails: mocks.welcome }))
import { registerWebEmailRoutes, validEmailCronSecret } from '../apps/server/src/routes/web-email.js'
import bcrypt from '../apps/server/node_modules/bcryptjs/index.js'
const app = Fastify()
beforeEach(() => { vi.clearAllMocks(); mocks.user=null; mocks.agency=false; mocks.execute.mockResolvedValue([]); vi.stubEnv('EMAIL_CRON_SECRET', 'x'.repeat(40)) })
afterEach(() => vi.unstubAllEnvs())
await registerWebEmailRoutes(app)
const post = (url: string, payload: any) => app.inject({ method: 'POST', url, payload })
describe('email account endpoint safety', () => {
  it('requires authentication before requesting or issuing service mail', async () => {
    expect((await post('/email/request', {})).statusCode).toBe(401)
    expect((await post('/email/service', {})).statusCode).toBe(401)
    expect(mocks.select).not.toHaveBeenCalled(); expect(mocks.enqueue).not.toHaveBeenCalled()
  })
  it('forbids a restaurant user from sending service messages', async () => {
    mocks.user={ id:'owner' }
    expect((await post('/email/service', {})).statusCode).toBe(403)
    expect(mocks.enqueue).not.toHaveBeenCalled()
  })
  it('rejects missing and invalid inputs without touching account data', async () => {
    mocks.user={id:'owner'}
    for(const payload of [{},{email:'bad',currentPassword:'pw'},{email:'new@example.com',currentPassword:''}]) expect((await post('/email/request',payload)).statusCode).toBe(400)
    expect(mocks.select).not.toHaveBeenCalled(); expect(mocks.enqueue).not.toHaveBeenCalled()
  })
  it('does not consume a token when email scanners GET the confirmation link', async () => {
    const response=await app.inject('/email/confirm?token='+'a'.repeat(43))
    expect(response.statusCode).toBe(200); expect(response.headers['cache-control']).toBe('no-store')
    expect(response.headers['referrer-policy']).toBe('no-referrer')
    expect(response.headers['content-security-policy']).toContain("frame-ancestors 'none'")
    expect(mocks.execute).not.toHaveBeenCalled(); expect(mocks.transaction).not.toHaveBeenCalled()
    expect(response.body).toContain("form.addEventListener('submit'")
  })
  it('invalid confirmation inputs cannot mutate the account', async () => {
    for(const payload of [{},{token:'short'},{token:'x'.repeat(129)}]) expect((await post('/email/confirm',payload)).statusCode).toBe(400)
    expect(mocks.transaction).not.toHaveBeenCalled()
  })
  it('rejects wrong password and same current address before opening a transaction', async () => {
    mocks.user={id:'owner'}
    const passwordHash=await bcrypt.hash('correct-password',4)
    mocks.select.mockReturnValue({from:()=>({where:()=>({limit:async()=>[{id:'owner',name:'QA',email:'old@example.com',passwordHash}]})})})
    const wrong=await post('/email/request',{email:'new@example.com',currentPassword:'wrong'})
    expect(wrong.statusCode).toBe(400); expect(wrong.json().error.code).toBe('WRONG_PASSWORD')
    const same=await post('/email/request',{email:'OLD@example.com',currentPassword:'correct-password'})
    expect(same.statusCode).toBe(400); expect(same.json().error.code).toBe('SAME_EMAIL')
    expect(mocks.transaction).not.toHaveBeenCalled(); expect(mocks.enqueue).not.toHaveBeenCalled()
  })
  it('rejects a stale password snapshot changed concurrently before the transaction lock', async () => {
    mocks.user={id:'owner'}; vi.stubEnv('WEB_ORIGIN','https://takoitalia.com')
    const passwordHash=await bcrypt.hash('correct-password',4)
    mocks.select.mockReturnValue({from:()=>({where:()=>({limit:async()=>[{id:'owner',name:'QA',email:'old@example.com',passwordHash,localOwnerSecretHash:null}]})})})
    const execute=vi.fn().mockResolvedValueOnce([]).mockResolvedValueOnce([{email:'old@example.com',password_hash:'changed-after-auth',local_owner_secret_hash:null}])
    mocks.transaction.mockImplementationOnce(async(fn:any)=>fn({execute}))
    const response=await post('/email/request',{email:'new@example.com',currentPassword:'correct-password'})
    expect(response.statusCode).toBe(409); expect(response.json().error.code).toBe('RETRY')
    expect(execute).toHaveBeenCalledTimes(2); expect(mocks.enqueue).not.toHaveBeenCalled(); expect(mocks.process).not.toHaveBeenCalled()
  })
  it('cron endpoint rejects absent and malformed secrets before dispatching', async () => {
    expect((await post('/email/tick',{})).statusCode).toBe(404)
    const response=await app.inject({method:'POST',url:'/email/tick',headers:{'x-tako-cron-secret':'wrong'},payload:{}})
    expect(response.statusCode).toBe(404); expect(mocks.welcome).not.toHaveBeenCalled(); expect(mocks.process).not.toHaveBeenCalled()
  })
  it('cron comparison fails closed for unicode, arrays, and short configured keys', () => {
    expect(validEmailCronSecret('é'.repeat(40),'x'.repeat(40))).toBe(false)
    expect(validEmailCronSecret(['x'.repeat(40)],'x'.repeat(40))).toBe(false)
    expect(validEmailCronSecret('short','short')).toBe(false)
    expect(validEmailCronSecret('x'.repeat(40),'x'.repeat(40))).toBe(true)
  })
})
