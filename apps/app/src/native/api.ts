// Client API del port nativo — stessa forma di owner-src/lib/api.ts.
//
// Regole invariate: base URL dinamica (LAN-first), autenticazione SEMPRE
// `Authorization: Bearer` (mai cookie), busta `{ data } | { error }` spacchettata
// una volta sola. Mancano di proposito le parti che servono solo al DOM
// (blobUrl per <img>, upload multipart, SSE del copilot): entrano col port delle
// schermate che le usano.

export class ApiError extends Error {
  status: number
  code: string
  constructor(message: string, status: number, code: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

export interface ApiDeps {
  base: () => string
  token: () => string | null
  /** Chiamata quando il server dice 401: sessione revocata o scaduta. */
  onUnauthorized?: () => void
}

export interface Envelope<T> {
  data: T
  meta?: { nextBefore?: string | null }
}

export interface Api {
  get<T>(path: string): Promise<T>
  /** Come get, ma con la busta intera: serve dove c'è `meta` (paginazione). */
  page<T>(path: string): Promise<Envelope<T>>
  post<T>(path: string, body?: unknown): Promise<T>
  patch<T>(path: string, body?: unknown): Promise<T>
  del<T>(path: string): Promise<T>
  /** URL assoluto di una risorsa. */
  url(path: string): string
}

export function createApi(deps: ApiDeps): Api {
  async function envelope<T>(method: string, path: string, body?: unknown): Promise<Envelope<T>> {
    const headers = new Headers()
    const token = deps.token()
    if (token) headers.set('Authorization', `Bearer ${token}`)
    if (body !== undefined) headers.set('Content-Type', 'application/json')

    const res = await fetch(`${deps.base()}/api${path}`, {
      method,
      headers,
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    })

    let json: { data?: unknown; meta?: { nextBefore?: string | null }; error?: { code?: string; message?: string } } | null = null
    try { json = await res.json() } catch { /* 204 o corpo non-JSON */ }

    if (!res.ok) {
      if (res.status === 401) deps.onUnauthorized?.()
      throw new ApiError(json?.error?.message ?? res.statusText, res.status, json?.error?.code ?? 'HTTP_ERROR')
    }
    return { data: (json?.data ?? null) as T, ...(json?.meta ? { meta: json.meta } : {}) }
  }

  async function req<T>(method: string, path: string, body?: unknown): Promise<T> {
    return (await envelope<T>(method, path, body)).data
  }

  return {
    get: (path) => req('GET', path),
    page: (path) => envelope('GET', path),
    post: (path, body) => req('POST', path, body),
    patch: (path, body) => req('PATCH', path, body),
    del: (path) => req('DELETE', path),
    url: (path) => `${deps.base()}${path.startsWith('/') ? path : `/${path}`}`,
  }
}
