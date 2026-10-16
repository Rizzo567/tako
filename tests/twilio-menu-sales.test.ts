// F3+F4 bot WhatsApp del titolare: promo e scarsità. DB e Groq finti (Groq esaurito), orologio finto solo su Date.
import { createRequire } from 'node:module'; import { createServer, type Server } from 'node:http'; import type { AddressInfo } from 'node:net'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { twilioSignature } from '../apps/server/src/lib/twilio-menu-command.js'
import { copy, salesCopy } from '../apps/server/src/lib/twilio-menu-copy.js'
import { parseSalesText, salesTurn, salesActionProblem } from '../apps/server/src/lib/twilio-menu-sales.js'
import { validateMenuPlan, effectiveMenuActions, type MenuRef } from '../apps/server/src/lib/twilio-menu-ai.js'
import { workspaceSchema } from '../apps/server/src/lib/menu-workspace-contract.js'
import { publicWorkspace } from '../apps/server/src/lib/menu-workspace-schedule.js'

vi.mock('../apps/server/src/lib/onboarding-chat.js', () => ({ expiredOnboardingNotice: async () => null, startsOnboarding: () => false, onboardingTransport: vi.fn(), queueOnboardingChat: vi.fn() }))
const tenant = '26050ecd-2e55-4057-a4c5-bff2b449cd47', actor = '44444444-4444-4444-8444-444444444444', phone = 'whatsapp:+391234567890'
const CARB = '55555555-5555-4555-8555-555555555551', TIRA = '55555555-5555-4555-8555-555555555552', AMAT = '55555555-5555-4555-8555-555555555553', MAR1 = '55555555-5555-4555-8555-555555555554', MAR2 = '55555555-5555-4555-8555-555555555555', GRIG = '55555555-5555-4555-8555-555555555556'
const base = () => workspaceSchema.parse({ menus: [
  { id: '66666666-6666-4666-8666-666666666661', name: 'Cena', sections: [{ id: '77777777-7777-4777-8777-777777777771', name: 'Primi', items: [{ id: CARB, name: 'Carbonara', price: 12 }, { id: AMAT, name: 'Amatriciana', price: 10 }, { id: TIRA, name: 'Tiramisù', price: 6 }, { id: GRIG, name: 'Grigliata mista', price: 20, priceDisplay: 'secondo peso' }, { id: MAR1, name: 'Margherita', price: 8 }] }] },
  { id: '66666666-6666-4666-8666-666666666662', name: 'Pranzo', sections: [{ id: '77777777-7777-4777-8777-777777777772', name: 'Pizze', items: [{ id: MAR2, name: 'Margherita', price: 7 }] }] },
], design: {} })
const state = { doc: base() as any, writes: 0, messages: new Map<string, string>(), proposals: new Map<string, { revision: number, command: any }>() }
const parse = (q: any) => { let text = ''; const params: unknown[] = []; for (const c of q.queryChunks) if (c && typeof c === 'object' && Array.isArray(c.value)) text += c.value.join(''); else { text += '$'; params.push(c) } return { text, params } }
const execute = async (q: unknown): Promise<any[]> => {
  const { text, params } = parse(q); const p = params as any[]
  if (text.startsWith('SELECT 1 FROM tako_whatsapp_links')) return [{}]
  if (text.startsWith('SELECT restaurant_id,actor_id,activated_at FROM tako_whatsapp_links')) return [{ restaurant_id: tenant, actor_id: actor, activated_at: new Date() }]
  if (text.includes('FROM users u')) return [{ id: actor, restaurant_id: tenant, role: 'owner', active: true }]
  if (text.includes('pg_advisory_xact_lock')) return []
  if (text.startsWith('SELECT response FROM tako_whatsapp_messages')) return state.messages.has(p[0]) ? [{ response: state.messages.get(p[0]) }] : []
  if (text.startsWith('INSERT INTO tako_whatsapp_messages')) { if (!state.messages.has(p[0])) state.messages.set(p[0], p[1]); return [] }
  if (text.startsWith('UPDATE tako_whatsapp_messages')) { state.messages.set(p[1], p[0]); return [] }
  if (text.startsWith('SELECT settings FROM restaurants')) return [{ settings: {} }]
  if (text.startsWith('SELECT name FROM restaurants')) return [{ name: 'Tako · Verifica web' }]
  if (text.startsWith('DELETE FROM tako_whatsapp_proposals')) { state.proposals.delete(p[0]); return [] }
  if (text.startsWith('SELECT 1 FROM tako_whatsapp_proposals')) return state.proposals.has(p[0]) ? [{}] : []
  if (text.startsWith('SELECT command,revision FROM tako_whatsapp_proposals')) { const x = state.proposals.get(p[0]); return x ? [x] : [] }
  if (text.startsWith('SELECT command FROM tako_whatsapp_proposals')) { const x = state.proposals.get(p[0]); return x ? [{ command: x.command }] : [] }
  if (text.startsWith('INSERT INTO tako_whatsapp_proposals')) { state.proposals.set(p[0], { revision: p[3], command: JSON.parse(p[4]) }); return [] }
  if (text.startsWith('INSERT INTO tako_whatsapp_ai_usage')) return [{ requests: 1, prompt_tokens: 0, completion_tokens: 0, rate_limited: 0, audio_seconds: 0, warned_at: null }]
  if (text.startsWith('UPDATE tako_whatsapp_ai_usage')) return []
  if (text.startsWith('INSERT INTO tako_whatsapp_errors')) return [{ id: 1 }]
  if (text.startsWith('SELECT count(*)::int AS n FROM tako_whatsapp_errors')) return [{ n: 0 }]
  throw new Error('Unexpected SQL ' + text.slice(0, 60))
}
vi.mock('../packages/db/src/index.ts', () => ({ db: { execute: (q: unknown) => execute(q), transaction: (fn: any) => fn({ execute }) }, sessions: {}, users: {} }))
vi.mock('../apps/server/src/lib/menu-workspace-store.ts', () => ({ readWorkspace: async () => ({ draft: structuredClone(state.doc), published: structuredClone(state.doc), revision: 7, published_revision: 7 }), mutateWorkspace: async (_t: string, _a: string, _r: number, w: any, publish: boolean) => { state.writes++; if (publish) state.doc = structuredClone(w); return { revision: 7 } } }))
import { twilioMenuRoutes } from '../apps/server/src/routes/twilio-menu.js'
const Fastify = createRequire(new URL('../apps/server/package.json', import.meta.url))('fastify')
const token = 'sales-token', self = 'https://takoitalia.com/api/whatsapp/twilio', account = 'AC' + '2'.repeat(32), sender = 'whatsapp:+18382622788'
let servers: Server[] = [], groqReply: any = null, chats: any[] = [], sent: Record<string, string>[] = []
const listen = async (h: Parameters<typeof createServer>[1]) => { const s = createServer(h); servers.push(s); await new Promise<void>(r => s.listen(0, '127.0.0.1', () => r())); return `http://127.0.0.1:${(s.address() as AddressInfo).port}` }
const read = (req: any) => new Promise<Buffer>(r => { const c: Buffer[] = []; req.on('data', (d: Buffer) => c.push(d)); req.on('end', () => r(Buffer.concat(c))) })
beforeAll(async () => {
  const groqUrl = await listen(async (req, res) => { const body = await read(req); chats.push(JSON.parse(body.toString())); res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ choices: [{ message: { content: JSON.stringify(groqReply) } }], usage: { prompt_tokens: 10, completion_tokens: 10 } })) })
  const twilioUrl = await listen(async (req, res) => { const body = await read(req); sent.push(Object.fromEntries(new URLSearchParams(body.toString()))); res.writeHead(201, { 'Content-Type': 'application/json' }); res.end('{}') })
  Object.assign(process.env, { TWILIO_AUTH_TOKEN: token, TWILIO_WEBHOOK_URL: self, TWILIO_ACCOUNT_SID: account, TWILIO_WHATSAPP_NUMBER: sender, GROQ_API_KEY: 'test-key', GROQ_API_BASE: groqUrl, TWILIO_API_BASE: twilioUrl, MENUSMART_WHATSAPP_WEBHOOK_URL: 'http://127.0.0.1:9/x' })
})
afterAll(() => { for (const s of servers) { s.closeAllConnections(); s.close() } })
// Venerdì 16/10/2026 alle 12:00 a Roma; solo Date è finto (server e timer veri).
const at = (iso: string) => vi.setSystemTime(new Date(iso))
beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'] }); at('2026-10-16T10:00:00Z'); state.doc = base(); state.writes = 0; state.messages.clear(); state.proposals.clear(); groqReply = null; chats = []; sent = [] })
afterEach(() => { vi.useRealTimers() })
let n = 0; const sid = () => 'SM' + (++n).toString(16).padStart(32, '0')
const say = async (a: any, body: string) => { const form = { AccountSid: account, From: phone, To: sender, NumMedia: '0', MessageSid: sid(), Body: body }; const r = await a.inject({ method: 'POST', url: '/api/whatsapp/twilio', headers: { 'content-type': 'application/x-www-form-urlencoded', 'x-twilio-signature': twilioSignature(token, self, form) }, payload: new URLSearchParams(form).toString() }); return r.body.replace(/&apos;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&') }
const app = async () => { const a = Fastify(); await a.register(twilioMenuRoutes, { prefix: '/api' }); return a }
const item = (id: string) => state.doc.menus.flatMap((m: any) => m.sections.flatMap((s: any) => s.items)).find((i: any) => i.id === id)

describe('frasi promo/scarsità riconosciute senza modello', () => {
  it('le cinque frasi del prompt e varianti comuni; il resto non viene intercettato', () => {
    expect(parseSalesText('carbonara in promo a 9 fino a domenica')).toEqual({ kind: 'promo', target: 'carbonara', price: 9, untilText: 'fino a domenica' })
    expect(parseSalesText('togli la promo dalla carbonara')).toEqual({ kind: 'promoOff', target: 'carbonara' })
    expect(parseSalesText('carbonara ultime porzioni')).toEqual({ kind: 'scarcity', target: 'carbonara', label: 'lastPortions', value: true })
    expect(parseSalesText('tiramisù solo per oggi')).toEqual({ kind: 'scarcity', target: 'tiramisu', label: 'onlyToday', value: true })
    expect(parseSalesText('togli ultime porzioni')).toEqual({ kind: 'scarcity', target: null, label: 'lastPortions', value: false })
    expect(parseSalesText('Metti la carbonara in promozione a 9,50 €')).toEqual({ kind: 'promo', target: 'carbonara', price: 9.5, untilText: null })
    expect(parseSalesText('amatriciana in offerta a nove euro fino al 20/10')).toMatchObject({ kind: 'promo', price: 9, untilText: 'fino al 20 10' })
    expect(parseSalesText('promo amatriciana a 8')).toMatchObject({ kind: 'promo', target: 'amatriciana', price: 8 })
    expect(parseSalesText('togli solo oggi dal tiramisù')).toEqual({ kind: 'scarcity', target: 'tiramisu', label: 'onlyToday', value: false })
    expect(parseSalesText('ultime porzioni di amatriciana')).toMatchObject({ label: 'lastPortions', target: 'amatriciana', value: true })
    expect(parseSalesText("la carbonara non è più in promo")).toEqual({ kind: 'promoOff', target: 'carbonara' })
    for (const t of ['carbonara finita', 'la carbonara costa 9', 'nascondi il polpo', 'cosa c\'è in promo?', 'oggi piatto del giorno: risotto, 16 €', 'togli la carbonara']) expect(parseSalesText(t), t).toBeNull()
  })
  it('promo valida solo se > 0 e < prezzo pieno; con prezzo scritto a testo non si applica', () => {
    const w = base()
    expect(salesActionProblem([{ kind: 'promo', id: CARB, price: 12, until: null }] as any, w)).toContain('più basso del prezzo pieno')
    expect(salesActionProblem([{ kind: 'promo', id: CARB, price: 9, until: null }] as any, w)).toBeNull()
    expect(salesActionProblem([{ kind: 'promo', id: CARB, price: null, until: null }] as any, w)).toBeNull()
    expect(salesActionProblem([{ kind: 'promo', id: GRIG, price: 15, until: null }] as any, w)).toContain('secondo peso')
    const refs: MenuRef[] = [{ id: CARB, name: 'Carbonara', price: 12, available: true, hidden: false, menu: 'Cena' }]
    expect(salesTurn('carbonara in promo a 9 fino a quando voglio io', w, refs, '2026-10-16')).toEqual({ reply: salesCopy.untilUnclear })
    expect(salesTurn('togli la promo', w, refs, '2026-10-16')).toEqual({ reply: salesCopy.noneWithLabel.promo })
  })
  it('azioni del modello (frasi composte): validate come le altre, mai date inventate', () => {
    const refs: MenuRef[] = [{ id: CARB, name: 'Carbonara', price: 12, available: true, hidden: false, menu: 'Cena' }, { id: TIRA, name: 'Tiramisù', price: 6, available: true, hidden: false, menu: 'Cena' }]
    const message = 'carbonara in promo a 9 fino a domenica e tiramisù solo per oggi'
    const plan = validateMenuPlan({ intent: 'change', actions: [{ action: 'set_promo', item_id: CARB, price: 9, until: 'domenica' }, { action: 'set_only_today', item_id: TIRA, value: true }] }, refs, { message })
    expect(plan).toEqual({ type: 'change', actions: [{ kind: 'promo', id: CARB, price: 9, until: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/) }, { kind: 'scarcity', id: TIRA, label: 'onlyToday', value: true }] })
    expect(validateMenuPlan({ intent: 'change', actions: [{ action: 'set_promo', item_id: CARB, price: 9, until: 'mercoledì' }] }, refs, { message })).toEqual({ type: 'clarify', ids: [CARB] })
    expect(validateMenuPlan({ intent: 'change', actions: [{ action: 'set_promo', item_id: CARB, price: -1 }] }, refs, { message }).type).toBe('clarify')
    expect(effectiveMenuActions([{ kind: 'promo', id: CARB, price: null, until: null }], base())).toEqual([])
  })
})

describe('flusso WhatsApp: promo (F3)', () => {
  it('«carbonara in promo a 9 fino a domenica» si pubblica subito (1 modifica ≤ 3), poi «togli la promo» la toglie', async () => {
    const a = await app()
    expect(await say(a, 'carbonara in promo a 9 fino a domenica')).toContain('*Carbonara*: in *promo* a *9,00 €* (prezzo pieno 12,00 €), fino a *domenica 18/10*')
    expect(state.writes).toBe(2); expect(item(CARB).promo).toEqual({ price: 9, until: '2026-10-18' })
    // pagina pubblica: visibile domenica notte, sparita lunedì alle 06:00
    const promo = (iso: string) => publicWorkspace(workspaceSchema.parse(state.doc), new Date(iso), { ignoreSchedules: true }).menus[0]!.sections[0]!.items.find(i => i.id === CARB)!.promo
    expect(promo('2026-10-19T03:59:00Z')).toEqual({ price: 9, until: '2026-10-18' }); expect(promo('2026-10-19T04:00:00Z')).toBeUndefined()
    expect(await say(a, 'carbonara in promo a 9 fino a domenica')).toContain(copy.noChanges)
    expect(await say(a, 'togli la promo dalla carbonara')).toContain('*Carbonara*: tolgo la *promo*, torna a 12,00 €')
    expect(item(CARB).promo).toBeUndefined(); expect(state.writes).toBe(4)
    await a.close()
  })
  it('promo non valida: il bot lo dice e non scrive nulla', async () => {
    const a = await app()
    expect(await say(a, 'carbonara in promo a 13')).toContain('deve essere *più basso del prezzo pieno* (12,00 €)')
    expect(await say(a, 'carbonara in promo a 12 euro')).toContain('*Non ho cambiato nulla.*')
    expect(await say(a, 'grigliata in promo a 15')).toContain('secondo peso')
    expect(await say(a, 'carbonara in promo a 9 fino a quando dico io')).toContain(salesCopy.untilUnclear)
    expect(state.writes).toBe(0); expect(item(CARB).promo).toBeUndefined()
    await a.close()
  })
  it('omonimi: chiede quale e applica la scelta con la stessa validazione', async () => {
    const a = await app()
    expect(await say(a, 'margherita in promo a 7')).toContain('Quale piatto intendi?')
    expect(await say(a, '2')).toContain(salesCopy.promoInvalid.split('{')[0]!) // Margherita del Pranzo costa 7: promo 7 non valida
    expect(state.writes).toBe(0)
    expect(await say(a, 'margherita in promo a 6')).toContain('Quale piatto intendi?')
    expect(await say(a, 'la prima')).toContain('in *promo* a *6,00 €* (prezzo pieno 8,00 €), finché non la togli')
    expect(item(MAR1).promo).toEqual({ price: 6, until: null }); expect(item(MAR2).promo).toBeUndefined()
    await a.close()
  })
  it('regola delle 3 modifiche: 4 azioni promo/scarsità dal modello → riepilogo, poi OK scritto pubblica', async () => {
    const a = await app()
    groqReply = { intent: 'change', actions: [{ action: 'set_promo', item_id: CARB, price: 9, until: 'domenica' }, { action: 'set_promo', item_id: AMAT, price: 8 }, { action: 'set_last_portions', item_id: TIRA, value: true }, { action: 'set_only_today', item_id: MAR1, value: true }] }
    await say(a, 'carbonara in promo a 9 fino a domenica, amatriciana in promo a 8, tiramisù ultime porzioni e margherita solo per oggi')
    const recap = sent.at(-1)!.Body
    expect(recap).toContain('1. *Carbonara*: in *promo*'); expect(recap).toContain('3. *Tiramisù*: etichetta *Ultime porzioni*'); expect(recap).toContain('*OK*')
    expect(state.writes).toBe(0)
    expect(await say(a, 'ok')).toContain('*Confermato.*')
    expect(state.writes).toBe(2); expect(item(AMAT).promo).toEqual({ price: 8, until: null }); expect(item(MAR1).scarcity).toEqual({ lastPortions: false, onlyToday: '2026-10-16' })
    // promo non valida dal modello: nessuna proposta, nessuna scrittura
    groqReply = { intent: 'change', actions: [{ action: 'set_promo', item_id: TIRA, price: 7 }, { action: 'set_promo', item_id: CARB, price: 8 }] }
    // Round 4: due promo nella stessa frase ora sono deterministiche (risposta immediata, senza IA): stessa validazione.
    const invalid = await say(a, 'tiramisù in promo a 7 e carbonara in promo a 8')
    expect(invalid).toContain('*Tiramisù*'); expect(invalid).toContain('*Non ho cambiato nulla.*'); expect(state.writes).toBe(2)
    await a.close()
  })
})

describe('flusso WhatsApp: scarsità (F4)', () => {
  it('«carbonara ultime porzioni», «tiramisù solo per oggi», «togli ultime porzioni»', async () => {
    const a = await app()
    expect(await say(a, 'carbonara ultime porzioni')).toContain('*Carbonara*: etichetta *Ultime porzioni*')
    expect(item(CARB).scarcity).toEqual({ lastPortions: true, onlyToday: null })
    expect(await say(a, 'tiramisù solo per oggi')).toContain('*Tiramisù*: etichetta *Solo oggi*, sparisce domani alle 6')
    expect(item(TIRA).scarcity).toEqual({ lastPortions: false, onlyToday: '2026-10-16' })
    expect(await say(a, 'togli ultime porzioni')).toContain('*Carbonara*: tolgo *Ultime porzioni*')
    expect(item(CARB).scarcity).toBeUndefined()
    expect(await say(a, 'togli ultime porzioni')).toContain(salesCopy.noneWithLabel.lastPortions)
    expect(state.writes).toBe(6)
    await a.close()
  })
  it('«Solo oggi» col cambio di giorno alle 06:00: alle 05:00 è ancora oggi, alle 07:00 è scaduto e si può rimettere', async () => {
    const a = await app()
    at('2026-10-16T21:00:00Z') // 23:00 a Roma
    await say(a, 'tiramisù solo per oggi'); expect(item(TIRA).scarcity.onlyToday).toBe('2026-10-16')
    const label = (iso: string) => publicWorkspace(workspaceSchema.parse(state.doc), new Date(iso), { ignoreSchedules: true }).menus[0]!.sections[0]!.items.find(i => i.id === TIRA)!.scarcity
    expect(label('2026-10-17T03:00:00Z')).toEqual({ lastPortions: false, onlyToday: '2026-10-16' }) // 05:00 Roma
    expect(label('2026-10-17T04:00:00Z')).toBeUndefined() // 06:00 Roma
    at('2026-10-17T03:00:00Z'); expect(await say(a, 'tiramisù solo per oggi')).toContain(copy.noChanges)
    at('2026-10-17T05:00:00Z'); expect(await say(a, 'togli solo oggi dal tiramisù')).toContain('*Tiramisù*: tolgo *Solo oggi*') // etichetta scaduta: si pulisce il documento
    expect(await say(a, 'tiramisù solo per oggi')).toContain('etichetta *Solo oggi*'); expect(item(TIRA).scarcity.onlyToday).toBe('2026-10-17')
    await a.close()
  })
  it('passaggio a esaurito: «carbonara finita» toglie «Ultime porzioni», tornata disponibile resta senza etichetta', async () => {
    const a = await app()
    await say(a, 'carbonara ultime porzioni'); expect(item(CARB).scarcity.lastPortions).toBe(true)
    expect(await say(a, 'è finita la carbonara')).toContain('*Carbonara*: *finito*')
    expect(item(CARB).available).toBe(false); expect(item(CARB).scarcity).toBeUndefined()
    expect(await say(a, 'la carbonara è tornata')).toContain('*Carbonara*: di nuovo *disponibile*')
    expect(item(CARB).scarcity).toBeUndefined()
    await a.close()
  })
  it('regressione: modifiche singole di prima invariate', async () => {
    const a = await app()
    expect(await say(a, 'la carbonara costa 13')).toContain('*Carbonara*: prezzo da 12,00 € a *13,00 €*')
    expect(await say(a, 'nascondi l\'amatriciana')).toContain('*Amatriciana*: *nascosto* dal menu')
    expect(await say(a, 'cosa sai fare')).toContain('*Promo*')
    expect(chats).toHaveLength(0)
    await a.close()
  })
})
