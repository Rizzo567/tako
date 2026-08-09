// F4.3 — Foto del piatto scattata col telefono.
//
// Due domande, e servono due strumenti diversi per rispondere:
//
//  1. «la foto caricata dall'app finisce sul piatto giusto?» → si prova via HTTP,
//     contro il server vero, con il Bearer di un telefono arruolato;
//  2. «con `aiPhotoEnabled: false` Gemini NON viene chiamato?» → non si può provare
//     da fuori: dall'esterno un originale salvato e un originale-perché-l'AI-ha-
//     fallito sono indistinguibili. Si importa `lib/dish-image-ai.ts` IN PROCESSO
//     (come fa tests/push-dispatch.test.ts) e si conta la rete: `globalThis.fetch`
//     viene sostituito e ogni chiamata a generativelanguage.googleapis.com viene
//     registrata. Zero chiamate = zero Gemini. Contare la rete è più forte che
//     guardare il risultato.
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import postgres from 'postgres'
import { seedTestEnv, jsonHeaders, SERVER, DB_URL, type TestEnv } from './helpers.js'

process.env['DATABASE_URL'] = process.env['DATABASE_URL'] ?? DB_URL

let env: TestEnv
let close: () => Promise<void>
let sql: ReturnType<typeof postgres>
let phone: string

// PNG 2×2 valido (magic bytes reali: `saveImageBuffer` sniffa il contenuto, non
// l'header dichiarato — un finto `image/jpeg` con dentro del testo viene respinto).
const PNG_2x2 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFElEQVR4nGP8z8Dwn4GBgYEJRIAAADkTAwbEbEQAAAAASUVORK5CYII=',
  'base64',
)

beforeAll(async () => {
  const s = await seedTestEnv()
  env = s.env
  close = s.close
  sql = postgres(DB_URL)

  const codeRes = await fetch(`${SERVER}/api/auth/device/enroll-code`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.staffToken}` },
    body: '{}',
  })
  const { code } = (await codeRes.json()).data as { code: string }
  const res = await fetch(`${SERVER}/api/auth/device/enroll`, {
    method: 'POST',
    headers: jsonHeaders(),
    body: JSON.stringify({ code, deviceName: 'Telefono foto', platform: 'iOS' }),
  })
  phone = ((await res.json()).data as { token: string }).token
})

afterAll(async () => {
  await sql.end()
  await close?.()
})

async function uploadPhoto(itemId: string, token = phone, buf: Buffer = PNG_2x2, filename = 'piatto.png', type = 'image/png') {
  const form = new FormData()
  form.append('file', new Blob([new Uint8Array(buf)], { type }), filename)
  const res = await fetch(`${SERVER}/api/menus/items/${itemId}/photo`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  })
  return { status: res.status, body: (await res.json()) as { data?: { id: string; imageUrl: string; styled: boolean }; error?: { code: string } } }
}

describe('F4.3 — foto del piatto dal telefono', () => {
  it('carica e ASSEGNA in un colpo solo: imageUrl a DB e file servito', async () => {
    const out = await uploadPhoto(env.menuItemId)
    expect(out.status).toBe(200)
    const url = out.body.data!.imageUrl
    // L'URL è dentro la cartella di QUESTO ristorante: è il confine che regge lo
    // scope tenant delle immagini (stessa regola dell'azione WhatsApp set_dish_image).
    expect(url.startsWith(`/uploads/${env.restaurantId}/`)).toBe(true)

    const [row] = await sql<{ image_url: string }[]>`select image_url from menu_items where id = ${env.menuItemId}`
    expect(row!.image_url).toBe(url)

    // La foto si scarica davvero (in LAN senza header: /uploads/* è statico).
    const file = await fetch(`${SERVER}${url}`)
    expect(file.status).toBe(200)
    expect(Number(file.headers.get('content-length'))).toBeGreaterThan(0)
  })

  it('con aiPhotoEnabled spento salva l\'ORIGINALE e non dichiara nessuno stile', async () => {
    await sql`update restaurants set settings = coalesce(settings, '{}'::jsonb) || '{"aiPhotoEnabled": false}'::jsonb where id = ${env.restaurantId}`
    const out = await uploadPhoto(env.menuItemId)
    expect(out.status).toBe(200)
    expect(out.body.data!.styled).toBe(false)
  })

  it('senza file risponde 400, non 500', async () => {
    const res = await fetch(`${SERVER}/api/menus/items/${env.menuItemId}/photo`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${phone}`, 'Content-Type': 'multipart/form-data; boundary=x' },
      body: '--x--\r\n',
    })
    expect(res.status).toBe(400)
  })

  it('un contenuto che non è un\'immagine viene respinto dai magic bytes', async () => {
    const out = await uploadPhoto(env.menuItemId, phone, Buffer.from('questo non è un JPEG, ma lo dichiara'), 'finto.jpg', 'image/jpeg')
    expect(out.status).toBe(400)
    expect(out.body.error?.code).toBe('INVALID_FILE_CONTENT')
  })

  it('un piatto di un altro ristorante è 404 (e non consuma l\'upload)', async () => {
    const other = await seedTestEnv()
    try {
      const out = await uploadPhoto(other.env.menuItemId)
      expect(out.status).toBe(404)
      const [row] = await sql<{ image_url: string | null }[]>`select image_url from menu_items where id = ${other.env.menuItemId}`
      expect(row!.image_url).toBeNull()
    } finally {
      await other.close()
    }
  })

  it('senza autenticazione non si carica niente', async () => {
    const form = new FormData()
    form.append('file', new Blob([new Uint8Array(PNG_2x2)], { type: 'image/png' }), 'x.png')
    const res = await fetch(`${SERVER}/api/menus/items/${env.menuItemId}/photo`, { method: 'POST', body: form })
    expect(res.status).toBe(401)
  })
})

describe('F4.3 — la pipeline AI, osservata dalla rete (in-process)', () => {
  it('aiPhotoEnabled=false → ZERO chiamate a Gemini e buffer identico', async () => {
    const { maybeStyleDishImage } = await import('../apps/server/src/lib/dish-image-ai.js')
    await sql`update restaurants set settings = coalesce(settings, '{}'::jsonb) || '{"aiPhotoEnabled": false}'::jsonb where id = ${env.restaurantId}`

    // Una chiave finta c'è: senza, il fast-fail scatterebbe PRIMA del flag e il test
    // dimostrerebbe la cosa sbagliata (che manca la chiave, non che il flag è spento).
    const prevKey = process.env['GEMINI_API_KEY']
    process.env['GEMINI_API_KEY'] = 'chiave-di-prova-mai-usata'

    const realFetch = globalThis.fetch
    const hits: string[] = []
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
      if (url.includes('generativelanguage.googleapis.com')) hits.push(url)
      return realFetch(input as RequestInfo, init)
    }) as typeof fetch

    try {
      const out = await maybeStyleDishImage(env.restaurantId, PNG_2x2, 'image/png')
      // Identità per RIFERIMENTO: è lo stesso buffer, non una copia uguale.
      expect(out).toBe(PNG_2x2)
      expect(hits).toEqual([])
    } finally {
      globalThis.fetch = realFetch
      if (prevKey === undefined) delete process.env['GEMINI_API_KEY']
      else process.env['GEMINI_API_KEY'] = prevKey
    }
  })

  it('aiPhotoEnabled=true ma appliance OFFLINE → ancora zero chiamate (fast-fail)', async () => {
    const { maybeStyleDishImage } = await import('../apps/server/src/lib/dish-image-ai.js')
    const connectivity = await import('../apps/server/src/lib/connectivity.js')
    await sql`update restaurants set settings = coalesce(settings, '{}'::jsonb) || '{"aiPhotoEnabled": true}'::jsonb where id = ${env.restaurantId}`

    const prevKey = process.env['GEMINI_API_KEY']
    process.env['GEMINI_API_KEY'] = 'chiave-di-prova-mai-usata'

    const realFetch = globalThis.fetch
    const hits: string[] = []
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
      if (url.includes('generativelanguage.googleapis.com')) hits.push(url)
      return realFetch(input as RequestInfo, init)
    }) as typeof fetch

    const realIsOnline = connectivity.isOnline
    Object.defineProperty(connectivity, 'isOnline', { value: () => false, configurable: true, writable: true })

    try {
      const out = await maybeStyleDishImage(env.restaurantId, PNG_2x2, 'image/png')
      expect(out).toBe(PNG_2x2)
      expect(hits).toEqual([])
    } finally {
      Object.defineProperty(connectivity, 'isOnline', { value: realIsOnline, configurable: true, writable: true })
      globalThis.fetch = realFetch
      if (prevKey === undefined) delete process.env['GEMINI_API_KEY']
      else process.env['GEMINI_API_KEY'] = prevKey
      await sql`update restaurants set settings = coalesce(settings, '{}'::jsonb) || '{"aiPhotoEnabled": false}'::jsonb where id = ${env.restaurantId}`
    }
  })
})
