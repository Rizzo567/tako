import { afterEach, describe, expect, it, vi } from 'vitest'
import { galleryInventory } from '../apps/server/src/lib/menu-workspace-gallery.js'

// La libreria immagini legge lo storage remoto: un oggetto caricato a mano con un nome
// fuori formato (es. `_style_ref.jpg`) faceva fallire GET /api/menu-workspace/assets con
// 500 «Errore interno» all'apertura di «Configura menu cliente».
const tenant = 'b056659e-3a1c-4fd2-af77-2a6cf80d1897'
const saved = { ...process.env }
afterEach(() => { process.env = { ...saved }; vi.unstubAllGlobals() })

describe('galleryInventory (storage remoto)', () => {
  it('salta gli oggetti con nome non valido invece di fallire', async () => {
    process.env.UPLOADS_DRIVER = 'supabase'
    process.env.SUPABASE_URL = 'https://example.supabase.co'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key-'.padEnd(40, 'x')
    process.env.SUPABASE_STORAGE_BUCKET = 'uploads'
    const rows = [
      { name: '_style_ref.jpg', metadata: { size: 10 } },
      { name: '.emptyFolderPlaceholder', metadata: { size: 0 } },
      { name: 'cartella', metadata: null },
      { name: 'AbCdEfGhIjKlMnOp.png', metadata: { size: 1234 } },
    ]
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(rows), { status: 200, headers: { 'content-type': 'application/json' } })))
    const list = await galleryInventory(tenant)
    expect(list).toEqual([{ url: `/uploads/${tenant}/AbCdEfGhIjKlMnOp.png`, name: 'AbCdEfGhIjKlMnOp.png', bytes: 1234, mime: 'image/png' }])
  })
})
