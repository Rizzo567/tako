// ─────────────────── Tako Owner — SELEZIONE DELL'ENDPOINT (dual-endpoint LAN-first) ───────────────────
//
// Il ristoratore non deve scegliere una rete. L'app prova la LAN, e solo se non risponde
// ripiega sul tunnel:
//
//   (1) http://tako.local:4317     LAN, ~5 ms, funziona anche con internet giù
//        │ timeout 1200 ms / errore di rete
//   (2) https://<host>.box…        tunnel Cloudflare, HTTPS valido, da qualunque rete
//        │ entrambi falliti
//   (3) offline                    ultima snapshot in cache, sola lettura
//
// Tre regole che qui valgono più di ogni ottimizzazione:
//
//  • LAN-FIRST SEMPRE. Quando l'appliance è raggiungibile in LAN non deve partire NESSUNA
//    richiesta verso il tunnel: è la differenza fra 5 ms e un giro su internet, e fra
//    funzionare e non funzionare quando il locale è senza uplink.
//  • RITORNO IN SALA AUTOMATICO. Il ristoratore che rientra nel locale deve tornare sulla
//    via veloce da solo: a ogni ritorno in foreground (`visibilitychange`) si ri-prova la LAN.
//  • MAI ATTESE LUNGHE SU RETE CELLULARE. Su cellulare `tako.local` non risolve e il DNS può
//    metterci secondi: lì il probe LAN si SALTA del tutto (Exit prevista dal piano F1.4).
//
// Nota che lega questo file al gate di F1.3: sull'hostname pubblico il server risponde 404
// a tutto ciò che non porta una sessione valida — anche a /health. Quindi il probe REMOTO
// viaggia con l'Authorization: Bearer quando un token c'è, e senza token l'endpoint remoto
// è considerato non disponibile (correttamente: senza sessione non ci si potrebbe fare nulla).

export type EndpointKind = 'lan' | 'remote' | 'offline'

export interface Endpoints {
  /** Base URL LAN (es. `http://tako.local:4317`). */
  lan: string | null
  /** Base URL remota via tunnel (es. `https://x.box.takoitalia.com`). null = LAN-only. */
  remote: string | null
}

export interface EndpointState {
  kind: EndpointKind
  /** Base URL da usare per le richieste. Stringa vuota = origine corrente (same-origin). */
  baseUrl: string
  /** Momento dell'ultima selezione riuscita (ms epoch). */
  since: number
}

const LS_ENDPOINTS = 'tako.owner.endpoints'
const LS_LAST_KIND = 'tako.owner.lastEndpointKind'

/** Timeout del probe LAN in condizioni normali (piano F1.4). */
export const LAN_PROBE_TIMEOUT_MS = 1200
/** Timeout ridotto su connessioni lente/misurate (Exit del piano F1.4). */
export const LAN_PROBE_TIMEOUT_SLOW_MS = 600
/** Il remoto passa da internet: gli si concede più respiro che alla LAN. */
export const REMOTE_PROBE_TIMEOUT_MS = 4000

// ─────────────────────────── Rete del dispositivo ───────────────────────────

interface NetworkInformationLike {
  type?: string
  effectiveType?: string
  saveData?: boolean
}

function connection(): NetworkInformationLike | null {
  const nav = navigator as Navigator & { connection?: NetworkInformationLike }
  return nav.connection ?? null
}

/**
 * Su rete cellulare il probe LAN si salta del tutto: `tako.local` non risolve fuori dal
 * locale e il tentativo costa secondi di attesa a ogni avvio (Exit del piano F1.4).
 */
export function shouldSkipLanProbe(): boolean {
  return connection()?.type === 'cellular'
}

/** 600 ms su rete lenta o con risparmio dati attivo, 1200 ms altrimenti. */
export function lanProbeTimeoutMs(): number {
  const c = connection()
  if (!c) return LAN_PROBE_TIMEOUT_MS
  if (c.saveData) return LAN_PROBE_TIMEOUT_SLOW_MS
  if (c.effectiveType === 'slow-2g' || c.effectiveType === '2g' || c.effectiveType === '3g') {
    return LAN_PROBE_TIMEOUT_SLOW_MS
  }
  return LAN_PROBE_TIMEOUT_MS
}

// ─────────────────────────── Persistenza ───────────────────────────

function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null // storage pieno, disabilitato o valore corrotto: non è un errore fatale
  }
}

function writeJson(key: string, value: unknown): void {
  try { localStorage.setItem(key, JSON.stringify(value)) } catch { /* best-effort */ }
}

/** Normalizza una base URL: senza slash finale. Stringa vuota = same-origin. */
function normalizeBase(url: string | null | undefined): string | null {
  const v = String(url ?? '').trim().replace(/\/+$/, '')
  return v.length ? v : null
}

export function loadEndpoints(): Endpoints {
  const saved = readJson<Endpoints>(LS_ENDPOINTS)
  return { lan: normalizeBase(saved?.lan), remote: normalizeBase(saved?.remote) }
}

export function saveEndpoints(e: Endpoints): void {
  writeJson(LS_ENDPOINTS, { lan: normalizeBase(e.lan), remote: normalizeBase(e.remote) })
}

/** Ultimo endpoint che ha funzionato: usato per non ripartire da zero a ogni avvio. */
export function loadLastKind(): EndpointKind | null {
  const v = readJson<EndpointKind>(LS_LAST_KIND)
  return v === 'lan' || v === 'remote' ? v : null
}

// ─────────────────────────── Probe ───────────────────────────

/**
 * `GET {base}/health` con timeout esplicito. `/health` esiste già nel server e in LAN non
 * richiede autenticazione; sul remoto il gate di F1.3 pretende una sessione valida, quindi
 * ci si porta dietro il Bearer quando c'è. Non lancia mai: risponde solo sì/no.
 */
export async function probe(base: string, timeoutMs: number, token?: string | null): Promise<boolean> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(`${base}/health`, {
      method: 'GET',
      cache: 'no-store',
      signal: ctrl.signal,
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    })
    return res.ok
  } catch {
    return false // timeout, DNS, rete assente, CORS: per noi è tutto "non raggiungibile"
  } finally {
    clearTimeout(timer)
  }
}

// ─────────────────────────── Selezione ───────────────────────────

export interface ResolveOptions {
  endpoints?: Endpoints
  /** Token di sessione: serve al probe remoto (il gate risponde 404 senza sessione). */
  token?: string | null
  /** Forza il salto del probe LAN (default: rete cellulare). */
  skipLan?: boolean
}

/**
 * Sceglie l'endpoint da usare ORA. LAN-first: se la LAN risponde non parte nessuna
 * richiesta verso il remoto. Ritorna sempre uno stato, anche 'offline'.
 */
export async function resolveEndpoint(opts: ResolveOptions = {}): Promise<EndpointState> {
  const endpoints = opts.endpoints ?? loadEndpoints()
  const token = opts.token ?? null
  const skipLan = opts.skipLan ?? shouldSkipLanProbe()

  if (endpoints.lan && !skipLan) {
    if (await probe(endpoints.lan, lanProbeTimeoutMs(), token)) {
      return select('lan', endpoints.lan)
    }
  }
  if (endpoints.remote) {
    if (await probe(endpoints.remote, REMOTE_PROBE_TIMEOUT_MS, token)) {
      return select('remote', endpoints.remote)
    }
  }
  return { kind: 'offline', baseUrl: '', since: Date.now() }
}

function select(kind: 'lan' | 'remote', baseUrl: string): EndpointState {
  writeJson(LS_LAST_KIND, kind)
  return { kind, baseUrl, since: Date.now() }
}

// ─────────────────────────── Gestore con ritorno automatico in LAN ───────────────────────────

export interface EndpointManagerOptions extends ResolveOptions {
  /** Chiamata a ogni cambio di stato (per il badge 🟢 In sala / 🟡 Da remoto / 🔴 Offline). */
  onChange?: (state: EndpointState) => void
}

export interface EndpointManager {
  state(): EndpointState
  /** Ri-seleziona l'endpoint adesso (usata all'avvio e a ogni riconnessione). */
  refresh(): Promise<EndpointState>
  /** URL assoluto per un percorso API sull'endpoint corrente. */
  url(path: string): string
  /** fetch sull'endpoint corrente, con Bearer se disponibile. */
  fetch(path: string, init?: RequestInit): Promise<Response>
  stop(): void
}

/**
 * Crea il gestore dell'endpoint e installa il ritorno automatico in LAN.
 *
 * Il listener su `visibilitychange` è la parte che si nota davvero usando l'app: quando il
 * ristoratore rientra nel locale e riapre l'app, si torna sulla LAN senza che debba fare
 * nulla. Ri-proviamo la LAN SOLO se non ci siamo già (nessun costo quando siamo già veloci).
 */
export function createEndpointManager(opts: EndpointManagerOptions = {}): EndpointManager {
  let state: EndpointState = { kind: 'offline', baseUrl: '', since: 0 }
  let inFlight: Promise<EndpointState> | null = null

  const emit = () => opts.onChange?.(state)

  async function refresh(): Promise<EndpointState> {
    if (inFlight) return inFlight // niente probe concorrenti: uno solo alla volta
    inFlight = resolveEndpoint(opts).then((next) => {
      const changed = next.kind !== state.kind || next.baseUrl !== state.baseUrl
      state = next
      if (changed) emit()
      return next
    }).finally(() => { inFlight = null })
    return inFlight
  }

  const onVisibility = () => {
    if (document.visibilityState !== 'visible') return
    if (state.kind === 'lan') return // già sulla via veloce: non sprecare un probe
    void refresh()
  }
  const onOnline = () => { void refresh() }

  document.addEventListener('visibilitychange', onVisibility)
  window.addEventListener('online', onOnline)

  return {
    state: () => state,
    refresh,
    url: (path: string) => `${state.baseUrl}${path.startsWith('/') ? path : `/${path}`}`,
    fetch: (path: string, init: RequestInit = {}) => {
      const headers = new Headers(init.headers)
      if (opts.token) headers.set('Authorization', `Bearer ${opts.token}`)
      return fetch(`${state.baseUrl}${path.startsWith('/') ? path : `/${path}`}`, { ...init, headers })
    },
    stop: () => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('online', onOnline)
    },
  }
}

/**
 * Impara i due endpoint dall'appliance stessa (`GET /api/system/info` → lanUrl/remoteUrl) e
 * li persiste. Va chiamata quando si è raggiungibili — tipicamente in LAN, dove l'app viene
 * installata. Best-effort: se fallisce restano gli endpoint già memorizzati.
 */
export async function learnEndpoints(base: string, token?: string | null): Promise<Endpoints> {
  const current = loadEndpoints()
  try {
    const res = await fetch(`${base}/api/system/info`, {
      cache: 'no-store',
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    })
    if (!res.ok) return current
    const info = await res.json()
    const next: Endpoints = {
      lan: normalizeBase(info?.data?.lanUrl) ?? current.lan,
      // remoteUrl null è un'informazione VERA (tunnel spento): va propagata, non ignorata.
      remote: normalizeBase(info?.data?.remoteUrl),
    }
    saveEndpoints(next)
    return next
  } catch {
    return current
  }
}
