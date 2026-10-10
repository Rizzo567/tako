/** Server-only Supabase Storage adapter. Browser URLs remain on the app origin. */
export function remoteStorageEnabled(): boolean {
  return process.env['UPLOADS_DRIVER'] === 'supabase'
}

export function remoteStorageConfig(env: NodeJS.ProcessEnv = process.env) {
  const raw = env['SUPABASE_URL'] ?? ''
  const url = new URL(raw)
  if (url.protocol !== 'https:' || !url.hostname.endsWith('.supabase.co') || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    throw new Error('SUPABASE_URL must be a hosted Supabase HTTPS origin')
  }
  const key = env['SUPABASE_SERVICE_ROLE_KEY']
  const bucket = env['SUPABASE_STORAGE_BUCKET'] ?? 'tako-menu-images'
  if (!key || key.length < 32) throw new Error('Server-only SUPABASE_SERVICE_ROLE_KEY is required')
  if (!/^[a-z0-9][a-z0-9-]{2,62}$/.test(bucket)) throw new Error('Invalid Supabase storage bucket')
  return { origin: url.origin, key, bucket }
}

export function imageObjectKey(restaurantId: string, filename: string): string {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(restaurantId) ||
      !/^[A-Za-z0-9_-]{16}\.(?:jpg|png|webp|gif)$/.test(filename)) throw new Error('Invalid image path')
  return `${restaurantId}/${filename}`
}

function headers() {
  const { key } = remoteStorageConfig()
  return { apikey: key, Authorization: `Bearer ${key}` }
}

/** Always count persisted objects, so quota survives application restarts. */
export async function remoteImageUsage(restaurantId: string): Promise<number> {
  imageObjectKey(restaurantId, 'abcdefghijklmnop.png')
  const { origin, bucket } = remoteStorageConfig()
  let total = 0
  for (let offset = 0; offset < 100_000; offset += 1000) {
    const response = await fetch(`${origin}/storage/v1/object/list/${bucket}`, {
      method: 'POST', headers: { ...headers(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ prefix: restaurantId, limit: 1000, offset, sortBy: { column: 'name', order: 'asc' } }),
      signal: AbortSignal.timeout(15_000),
    })
    if (!response.ok) throw new Error('Image storage unavailable')
    const entries: unknown = await response.json()
    if (!Array.isArray(entries)) throw new Error('Invalid storage response')
    for (const entry of entries) {
      if (entry.metadata?.size == null) throw new Error('Missing object size')
      const size = Number(entry.metadata.size)
      if (!Number.isFinite(size) || size < 0) throw new Error('Invalid object size')
      total += size
    }
    if (entries.length < 1000) return total
  }
  throw new Error('Image quota inventory exceeded safe limit')
}

export async function uploadRemoteImage(restaurantId: string, filename: string, bytes: Buffer, contentType: string): Promise<void> {
  const key = imageObjectKey(restaurantId, filename)
  const { origin, bucket } = remoteStorageConfig()
  const response = await fetch(`${origin}/storage/v1/object/${bucket}/${key}`, {
    method: 'POST', headers: { ...headers(), 'Content-Type': contentType, 'x-upsert': 'false', 'Cache-Control': '31536000' },
    body: new Uint8Array(bytes), signal: AbortSignal.timeout(30_000),
  })
  if (!response.ok) throw new Error('Image upload failed')
}

export async function downloadRemoteImage(restaurantId: string, filename: string): Promise<Response> {
  const key = imageObjectKey(restaurantId, filename)
  const { origin, bucket } = remoteStorageConfig()
  return fetch(`${origin}/storage/v1/object/authenticated/${bucket}/${key}`, {
    headers: headers(), signal: AbortSignal.timeout(15_000),
  })
}
