// Live 16/10: the edge bridge forwards only an allowlist of headers; without «x-tako-cron-secret» the tick
// route never sees the secret and always answers 404, so the 06:00 job never runs.
import {describe,expect,it} from 'vitest'
import {readFileSync} from 'node:fs'
describe('edge bridge forwards the preset cron secret',()=>{
 it('x-tako-cron-secret is in the forwarded header allowlist',()=>{
  const bridge=readFileSync(new URL('../../scripts/serverless/fetch-bridge.mjs',import.meta.url),'utf8')
  const list=bridge.match(/for\(const name of \[([^\]]*)\]\)/)![1]
  expect(list).toContain("'x-tako-cron-secret'");expect(list).not.toMatch(/x-forwarded|x-real-ip/)
 })
})
describe('edge runtime globals',()=>{
 it('the tick route imports Buffer from node:buffer (no Buffer global on the Deno edge)',()=>{
  const route=readFileSync(new URL('../../apps/server/src/routes/menu-day-presets.ts',import.meta.url),'utf8')
  expect(route).toMatch(/import \{ Buffer \} from 'node:buffer'/)
 })
})
