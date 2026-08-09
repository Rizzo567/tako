// F5.1 — Copilot owner: proporre non è eseguire.
//
// Lo Stop del piano chiede due prove che nessun test HTTP da solo può dare:
//
//  1. un messaggio che innesca una mutation deve produrre `pending[]` e lasciare il
//     DATABASE INTATTO. Dall'esterno non si può innescare: la chat vera ha bisogno
//     di Groq, e una chiave vera nei test è fuori discussione (costa, è non
//     deterministica, e finisce nei log). Il turno si esercita quindi IN PROCESSO
//     e si INTERCETTA LA RETE, come in tests/menu-photo.test.ts: gira il MOTORE
//     vero (`runAssistant`, il registro azioni, il DB), l'unica cosa finta è la
//     risposta del modello — che è esattamente la parte di cui non ci fidiamo.
//  2. `/execute` invece cambia i dati per davvero, e quella rotta NON usa Groq:
//     si prova via HTTP contro il server vivo, come la usa il telefono.
//
// La terza prova è il gate dei ruoli (`ai-actions.ts`, executeAction): le sette
// azioni con `roles` ristretti devono restare rifiutate a un dipendente anche
// passando dal copilot, altrimenti la chat sarebbe una scorciatoia per privilegi
// che via HTTP quel ruolo non ha.
//
// NOTA sull'intercettazione. L'SDK `openai` in Node non usa `globalThis.fetch` ma
// `node-fetch`, quindi sostituire il fetch globale non basterebbe: si importa PRIMA
// `openai/shims/web`, che è il modo previsto dall'SDK per farlo passare dal fetch
// standard. Deve accadere prima di qualunque altro import di `openai` — da qui
// `vi.hoisted()`, che è l'unica cosa che gira prima degli import di questo file.
// Il percorso è relativo perché `openai` è una dipendenza di `apps/server`, non del
// workspace radice da cui girano i test: `import 'openai/shims/web'` non risolve.
import '../apps/server/node_modules/openai/shims/web.mjs'
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import postgres from 'postgres'
import { randomUUID } from 'node:crypto'
import { seedTestEnv, jsonHeaders, SERVER, DB_URL, type TestEnv } from './helpers.js'

process.env['DATABASE_URL'] = DB_URL

interface Scripted { content?: string; toolCalls?: { name: string; args: unknown }[] }

const groq = vi.hoisted(() => {
  // Chiave FINTA e obbligatoria: `groqClient()` fallisce prima di tutto il resto se
  // manca, e il test dimostrerebbe la cosa sbagliata (un 503, non il gate).
  process.env['GROQ_API_KEY'] = 'gsk_finta_per_i_test_mai_una_vera'

  /** Risposte che il finto modello restituirà, in ordine; poi solo testo semplice. */
  const scripted: { content?: string; toolCalls?: { name: string; args: unknown }[] }[] = []
  /** Ogni giro verso il provider viene registrato: nessuno esce da questo processo. */
  const calls: { model: string; toolNames: string[] }[] = []

  const realFetch = globalThis.fetch
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : (input as Request).url
    if (!url.includes('api.groq.com')) return realFetch(input, init)

    const body = JSON.parse(String(init?.body ?? '{}')) as { model: string; tools?: { function: { name: string } }[] }
    calls.push({ model: body.model, toolNames: (body.tools ?? []).map((t) => t.function.name) })
    const next = scripted.shift()
    const toolCalls = (next?.toolCalls ?? []).map((tc, i) => ({
      id: `call_${i}`,
      type: 'function',
      function: { name: tc.name, arguments: JSON.stringify(tc.args) },
    }))
    const payload = {
      id: 'chatcmpl-finta', object: 'chat.completion', created: 0, model: body.model,
      choices: [{
        index: 0,
        message: { role: 'assistant', content: next?.content ?? '', ...(toolCalls.length ? { tool_calls: toolCalls } : {}) },
        finish_reason: toolCalls.length ? 'tool_calls' : 'stop',
      }],
      usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
    }
    return new Response(JSON.stringify(payload), { status: 200, headers: { 'content-type': 'application/json' } })
  }) as typeof fetch

  return { scripted, calls }
})

const scripted = groq.scripted as Scripted[]
const providerCalls = groq.calls

type AiModule = typeof import('../apps/server/src/lib/ai-actions.js')
let ai: AiModule

let env: TestEnv
let close: () => Promise<void>
let sql: ReturnType<typeof postgres>
/** Dipendente dello stesso ristorante: il ruolo che il gate deve fermare. */
let dip: { id: string; token: string }

const owner = () => jsonHeaders(`tako_session=${env.staffToken}`)
const employee = () => jsonHeaders(`tako_session=${dip.token}`)

const execute = (headers: Record<string, string>, name: string, args: Record<string, unknown> = {}) =>
  fetch(`${SERVER}/api/ai/owner/execute`, { method: 'POST', headers, body: JSON.stringify({ name, args }) })

const availability = async (): Promise<boolean> => {
  const [row] = await sql`select available from menu_items where id = ${env.menuItemId}`
  return row!['available'] as boolean
}

beforeAll(async () => {
  const s = await seedTestEnv()
  env = s.env
  close = s.close
  sql = postgres(DB_URL)

  const [u] = await sql`
    insert into users (restaurant_id, name, email, role)
    values (${env.restaurantId}, 'Cameriere', ${'dip-' + randomUUID().slice(0, 8) + '@test.local'}, 'dipendente')
    returning id`
  const token = `test_sess_${randomUUID().replace(/-/g, '')}`
  await sql`insert into sessions (user_id, token, expires_at) values (${u!['id']}, ${token}, now() + interval '1 day')`
  dip = { id: u!['id'] as string, token }

  ai = await import('../apps/server/src/lib/ai-actions.js')
})

afterAll(async () => {
  await sql?.end()
  await close?.()
})

describe('F5.1 · il copilot PROPONE la mutation, non la esegue', () => {
  it('«segna esaurito» produce pending[] e lascia il database intatto', async () => {
    expect(await availability()).toBe(true)
    scripted.length = 0
    scripted.push({ toolCalls: [{ name: 'set_item_availability', args: { itemName: 'Piatto Test', available: false } }] })

    const turn = await ai.runAssistant({
      scope: 'owner',
      ctx: { restaurantId: env.restaurantId, role: 'owner' },
      systemPrompt: 'Sei il copilot di prova.',
      history: [],
      userMessage: 'segna esaurito il Piatto Test',
    })

    expect(turn.pending).toHaveLength(1)
    expect(turn.pending[0]!.name).toBe('set_item_availability')
    expect(turn.pending[0]!.args).toMatchObject({ itemName: 'Piatto Test', available: false })
    // L'etichetta è ciò che il ristoratore legge sulla card: deve nominare il piatto.
    expect(turn.pending[0]!.label).toContain('Piatto Test')
    // Nessuna azione "già applicata" può essere una mutation.
    expect(turn.actions).toHaveLength(0)
    // E soprattutto: il piatto è ANCORA a menu.
    expect(await availability()).toBe(true)
  })

  it('la stessa azione chiamata senza conferma esplicita viene rifiutata dal motore', async () => {
    // Difesa in profondità: anche chiamando executeAction direttamente, senza
    // `allowMutation`, la mutation non parte. È l'invariante su cui poggia la card.
    const res = await ai.executeAction(
      'set_item_availability',
      { itemName: 'Piatto Test', available: false },
      { restaurantId: env.restaurantId, role: 'owner' },
      'owner',
    )
    expect(res.ok).toBe(false)
    expect(res.summary).toMatch(/conferma/i)
    expect(await availability()).toBe(true)
  })

  it('dopo /execute il piatto è esaurito davvero', async () => {
    const res = await execute(owner(), 'set_item_availability', { itemName: 'Piatto Test', available: false })
    expect(res.status).toBe(200)
    const body = await res.json() as { data: { ok: boolean; summary: string } }
    expect(body.data.ok).toBe(true)
    expect(await availability()).toBe(false)

    // e si torna indietro dalla stessa porta
    const back = await execute(owner(), 'set_item_availability', { itemName: 'Piatto Test', available: true })
    expect(back.status).toBe(200)
    expect(await availability()).toBe(true)
  })

  it('nessuna chiamata è uscita verso un provider vero', () => {
    // Il finto ha registrato ogni giro; se il modulo `openai` non fosse stato
    // sostituito, `runAssistant` avrebbe tentato la rete e sarebbe fallito prima.
    expect(providerCalls.length).toBeGreaterThan(0)
    expect(providerCalls[0]!.toolNames).toContain('set_item_availability')
  })
})

describe('F5.1 · il gate dei ruoli vale anche passando dal copilot', () => {
  // Le sette azioni che `ai-actions.ts` restringe per parità con le route REST.
  const RESTRICTED: { name: string; args: Record<string, unknown> }[] = [
    { name: 'apply_bill_discount', args: { tableNumber: 'T1', amount: 5 } },
    { name: 'close_bill', args: { tableNumber: 'T1', method: 'cash' } },
    { name: 'clock_in_staff', args: { staffName: 'Cameriere' } },
    { name: 'clock_out_staff', args: { staffName: 'Cameriere' } },
    { name: 'create_staff', args: { name: 'Nuovo Membro', role: 'dipendente' } },
    { name: 'set_staff_active', args: { staffName: 'Cameriere', active: false } },
    { name: 'set_cover_charge', args: { amount: 2 } },
  ]

  it.each(RESTRICTED)('un dipendente non può eseguire $name', async ({ name, args }) => {
    const res = await execute(employee(), name, args)
    expect(res.status).toBe(422)
    const body = await res.json() as { error: { code: string; message: string } }
    expect(body.error.code).toBe('ACTION_FAILED')
    // Il messaggio distingue il RIFIUTO PER RUOLO da un fallimento qualsiasi: senza
    // questo assert il test passerebbe anche se l'azione fallisse per altro.
    expect(body.error.message).toMatch(/ruolo autorizzato/i)
  })

  it('il dipendente non è stato creato: il rifiuto è avvenuto PRIMA di scrivere', async () => {
    const rows = await sql`select id from users where restaurant_id = ${env.restaurantId} and name = 'Nuovo Membro'`
    expect(rows.length).toBe(0)
  })

  it('un dipendente può invece usare le azioni non ristrette (lettura)', async () => {
    const res = await execute(employee(), 'table_status', {})
    expect(res.status).toBe(200)
  })

  it('un\'azione fuori scope owner non esiste per questa rotta', async () => {
    const res = await execute(owner(), 'azione_inventata', {})
    expect(res.status).toBe(400)
    expect((await res.json() as { error: { code: string } }).error.code).toBe('UNKNOWN_ACTION')
  })
})
