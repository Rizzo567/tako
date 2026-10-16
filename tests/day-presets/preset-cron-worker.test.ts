import { it, expect } from 'vitest'
// @ts-expect-error modulo .mjs del Worker senza tipi
import { tickRequest, runTick } from '../../deploy/cloudflare/preset-cron.mjs'
const env = { TAKO_BACKEND_READY: 'true', TAKO_EDGE_URL: 'https://abc.supabase.co/functions/v1/tako-operational-candidate', TAKO_GATEWAY_SECRET: 'g'.repeat(40), TAKO_PRESET_CRON_SECRET: 'c'.repeat(40) }
it('il cron del Worker chiama solo il tick del backend, con i segreti, e si spegne se manca la configurazione', async () => {
 const req = tickRequest(env)!
 expect(req.method).toBe('POST')
 expect(req.url).toBe('https://abc.supabase.co/functions/v1/tako-operational-candidate/api/day-presets-cron/tick')
 expect(req.headers.get('x-tako-cron-secret')).toBe('c'.repeat(40))
 expect(req.headers.get('origin')).toBe('https://takoitalia.com')
 expect(tickRequest({ ...env, TAKO_PRESET_CRON_SECRET: 'corto' })).toBeNull()
 expect(tickRequest({ ...env, TAKO_EDGE_URL: 'https://evil.example/functions/v1/x' })).toBeNull()
 expect(tickRequest({ ...env, TAKO_BACKEND_READY: 'false' })).toBeNull()
 const seen: string[] = []
 expect(await runTick(env, async (r: Request) => { seen.push(r.url); return new Response('{}', { status: 200 }) })).toEqual({ ok: true, status: 200 })
 expect(seen).toHaveLength(1)
 expect(await runTick({}, async () => { throw new Error('non deve chiamare') })).toEqual({ ok: false, reason: 'not_configured' })
})
it('la rotta del tick risponde 404 senza il segreto giusto (confronto a tempo costante)', async () => {
 const { cronSecretValid } = await import('../../apps/server/src/routes/menu-day-presets.js')
 expect(cronSecretValid('c'.repeat(40), 'c'.repeat(40))).toBe(true)
 expect(cronSecretValid('c'.repeat(39), 'c'.repeat(40))).toBe(false)
 expect(cronSecretValid(undefined, 'c'.repeat(40))).toBe(false)
 expect(cronSecretValid('corto', 'corto')).toBe(false)
})
