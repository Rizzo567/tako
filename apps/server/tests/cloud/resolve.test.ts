// Vecchi QR dell'appliance: reindirizzati alla webapp pubblica, senza open-redirect.
import { describe, it, expect, afterEach } from 'vitest'
import Fastify from 'fastify'
import { cloudResolveRoutes } from '../../src/routes/cloud/resolve.js'

const APPL = '3f2a1b4c-5d6e-4f70-8a9b-0c1d2e3f4a5b'
const TAIL = 'r/7a8b9c0d-1e2f-4a3b-8c4d-5e6f7a8b9c0d/t/AbC_123-x'

async function app() {
  const f = Fastify()
  await f.register(cloudResolveRoutes)
  return f
}

afterEach(() => { delete process.env['WEB_PUBLIC_URL'] })

describe('vecchi QR /t/:applianceId/*', () => {
  it('reindirizza allo stesso percorso sulla webapp pubblica', async () => {
    process.env['WEB_PUBLIC_URL'] = 'https://menu.takoitalia.com/'
    const res = await (await app()).inject({ url: `/t/${APPL}/${TAIL}` })
    expect(res.statusCode).toBe(302)
    expect(res.headers['location']).toBe(`https://menu.takoitalia.com/${TAIL}`)
  })

  it('senza WEB_PUBLIC_URL mostra «Menu in aggiornamento» (503)', async () => {
    const res = await (await app()).inject({ url: `/t/${APPL}/${TAIL}` })
    expect(res.statusCode).toBe(503)
    expect(res.body).toContain('Menu in aggiornamento')
  })

  it('rifiuta id o percorsi fuori formato (404, nessun redirect)', async () => {
    process.env['WEB_PUBLIC_URL'] = 'https://menu.takoitalia.com'
    const f = await app()
    for (const url of [`/t/non-uuid/${TAIL}`, `/t/${APPL}/r/x/evil`, `/t/${APPL}/r/a%2F..%2Fb/t/c`, `/t/${APPL}/r/a/t/b?next=https://evil.example`]) {
      const res = await f.inject({ url })
      if (url.includes('?next=')) { expect(res.headers['location']).toBe('https://menu.takoitalia.com/r/a/t/b'); continue }
      expect(res.statusCode).toBe(404)
      expect(res.headers['location']).toBeUndefined()
    }
  })

  it('WEB_PUBLIC_URL non https viene rifiutata', async () => {
    process.env['WEB_PUBLIC_URL'] = 'http://evil.example'
    const res = await (await app()).inject({ url: `/t/${APPL}/${TAIL}` })
    expect(res.statusCode).toBe(500)
    expect(res.headers['location']).toBeUndefined()
  })
})
