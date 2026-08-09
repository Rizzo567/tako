// Client API dell'app owner.
//
// Due regole che valgono per ogni chiamata di questo file:
//   • l'URL di base NON è fisso: arriva dall'EndpointManager (LAN-first, poi tunnel),
//     e può cambiare mentre l'app è aperta — quando il ristoratore esce o rientra;
//   • l'autenticazione è SEMPRE `Authorization: Bearer`, mai un cookie.
//
// La risposta del server è sempre `{ data }` oppure `{ error: { code, message } }`
// (convenzione di tutte le route in apps/server/src/routes): qui si spacchetta una
// volta sola, così le schermate ricevono già il dato.

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
  /** Base URL corrente (stringa vuota = stessa origine). */
  base: () => string
  /** Token di sessione, o null se il telefono non è ancora arruolato. */
  token: () => string | null
  /** Chiamata quando il server dice 401: la sessione è stata revocata o è scaduta. */
  onUnauthorized?: () => void
}

export interface Envelope<T> {
  data: T
  meta?: { nextBefore?: string | null }
}

export interface Api {
  get<T>(path: string, init?: RequestInit): Promise<T>
  /** Come get, ma restituisce la busta intera: serve dove c'è `meta` (paginazione). */
  page<T>(path: string): Promise<Envelope<T>>
  post<T>(path: string, body?: unknown, init?: RequestInit): Promise<T>
  patch<T>(path: string, body?: unknown, init?: RequestInit): Promise<T>
  del<T>(path: string, init?: RequestInit): Promise<T>
  /** URL assoluto di una risorsa (per <img>, download, ecc.). */
  url(path: string): string
  /** Scarica una risorsa protetta e ne restituisce il Blob (null se non disponibile). */
  blob(path: string): Promise<Blob | null>
  /** Scarica una risorsa protetta e ne restituisce un blob URL (vedi immagini sotto). */
  blobUrl(path: string): Promise<string | null>
  /** Invia un file in multipart (foto piatto). Ritorna il `data` della risposta. */
  upload<T>(path: string, file: Blob, filename: string, field?: string): Promise<T>
}

export function createApi(deps: ApiDeps): Api {
  async function envelope<T>(method: string, path: string, body?: unknown, init: RequestInit = {}): Promise<Envelope<T>> {
    const headers = new Headers(init.headers)
    const token = deps.token()
    if (token) headers.set('Authorization', `Bearer ${token}`)
    if (body !== undefined) headers.set('Content-Type', 'application/json')

    const res = await fetch(`${deps.base()}/api${path}`, {
      ...init,
      method,
      headers,
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    })

    let json: { data?: unknown; meta?: { nextBefore?: string | null }; error?: { code?: string; message?: string } } | null = null
    try { json = await res.json() } catch { /* 204 o corpo non-JSON */ }

    if (!res.ok) {
      // 401 = sessione revocata dalla dashboard o scaduta: l'app deve tornare
      // alla schermata di collegamento, non riprovare all'infinito.
      if (res.status === 401) deps.onUnauthorized?.()
      throw new ApiError(json?.error?.message ?? res.statusText, res.status, json?.error?.code ?? 'HTTP_ERROR')
    }
    return { data: (json?.data ?? null) as T, ...(json?.meta ? { meta: json.meta } : {}) }
  }

  async function req<T>(method: string, path: string, body?: unknown, init: RequestInit = {}): Promise<T> {
    return (await envelope<T>(method, path, body, init)).data
  }

  return {
    get: (path, init) => req('GET', path, undefined, init),
    page: (path) => envelope('GET', path),
    post: (path, body, init) => req('POST', path, body, init),
    patch: (path, body, init) => req('PATCH', path, body, init),
    del: (path, init) => req('DELETE', path, undefined, init),
    url: (path) => `${deps.base()}${path.startsWith('/') ? path : `/${path}`}`,

    // Immagini protette (foto dei piatti in /uploads/*). DA REMOTO un `<img src>` NON
    // porta l'header Authorization — è una navigazione del browser — quindi il gate
    // del tunnel risponde 404 e la foto non si vede (rischio residuo documentato in
    // F1). Rimedio: scaricare il file con fetch + Bearer e passare all'<img> un blob:
    // URL. Nessun cookie da inventare, nessuna URL firmata da far scadere, e in LAN
    // il costo è lo stesso di prima.
    blob: async (path: string) => {
      try {
        const headers = new Headers()
        const token = deps.token()
        if (token) headers.set('Authorization', `Bearer ${token}`)
        const res = await fetch(`${deps.base()}${path.startsWith('/') ? path : `/${path}`}`, { headers })
        if (res.status === 401) deps.onUnauthorized?.()
        if (!res.ok) return null
        return await res.blob()
      } catch {
        return null
      }
    },

    blobUrl: async (path: string) => {
      try {
        const headers = new Headers()
        const token = deps.token()
        if (token) headers.set('Authorization', `Bearer ${token}`)
        const res = await fetch(`${deps.base()}${path.startsWith('/') ? path : `/${path}`}`, { headers })
        if (!res.ok) return null
        return URL.createObjectURL(await res.blob())
      } catch {
        return null
      }
    },

    // Multipart. Il Content-Type NON si imposta a mano: il browser deve poterci
    // mettere il `boundary`, e un header scritto da noi lo cancellerebbe — il
    // server riceverebbe un multipart senza confine e risponderebbe 400.
    upload: async <T,>(path: string, file: Blob, filename: string, field = 'file'): Promise<T> => {
      const headers = new Headers()
      const token = deps.token()
      if (token) headers.set('Authorization', `Bearer ${token}`)
      const form = new FormData()
      form.append(field, file, filename)
      const res = await fetch(`${deps.base()}/api${path}`, { method: 'POST', headers, body: form })
      let json: { data?: unknown; error?: { code?: string; message?: string } } | null = null
      try { json = await res.json() } catch { /* corpo non-JSON */ }
      if (!res.ok) {
        if (res.status === 401) deps.onUnauthorized?.()
        throw new ApiError(json?.error?.message ?? res.statusText, res.status, json?.error?.code ?? 'HTTP_ERROR')
      }
      return (json?.data ?? null) as T
    },
  }
}
