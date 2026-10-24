// Menu pubblico in tempo reale (Compito 2, 16/10/2026).
// Un trigger nel database, al commit di una pubblicazione / disponibilità / impostazioni del locale,
// invia sul canale PRIVATO Supabase Realtime "menu-live:<id>" un solo segnale {at}: nessun dato del menu,
// nessuna bozza. I telefoni possono solo ricevere (policy RLS di sola lettura su realtime.messages).
// Il segnale dice «rileggi»; dal 17/10 per i cambi piccoli porta anche il delta GIÀ PUBBLICATO dei piatti (d):
// la pagina lo applica subito e poi riconferma con una rilettura distanziata. Senza d si rilegge quasi subito.
// Riserva senza socket: una lettura alla ripresa (visibilitychange/online/pageshow) e al massimo una ogni 60 s.
// Socket aperto solo con la scheda visibile: in background si chiude (niente batteria né dati).
const REALTIME_URL = 'wss://tcfccmvpycivxuxkoqpw.supabase.co/realtime/v1/websocket'
// Chiave pubblicabile del progetto (pubblica per progetto: il ruolo anon non ha permessi sulle tabelle).
const PUBLISHABLE_KEY = 'sb_publishable_fViwhGL9YpU0OYzaHhlydw_nz1JH3px'
const HEARTBEAT_MS = 25000, HEARTBEAT_TIMEOUT_MS = 10000, FALLBACK_MS = 60000, HIDDEN_CLOSE_MS = 15000
const BACKOFF_MS = [1000, 2000, 5000, 10000, 30000, 60000], RESUME_CHECK_MS = 8000

export type LiveReason = 'push' | 'resume' | 'poll' | 'reconcile'
/** Cambio di un piatto già pubblicato: i=id, m=menu, n=nome, ds=descrizione, p=prezzo, t=traduzioni, h=nascosto, a=disponibile. */
export type LiveChange = { i: string; m?: string; n?: string; ds?: string | null; p?: number; t?: Record<string, { name?: string; description?: string | null }>; h?: boolean; a?: boolean }
export type LiveSignal = { at?: number; k?: string; d?: LiveChange[] }
export type LiveOptions = { url?: string; key?: string; WebSocketImpl?: typeof WebSocket; now?: () => number }

/** Osserva il menu pubblicato di un locale; onChange viene chiamato quando conviene rileggerlo. Restituisce lo stop. */
export function watchPublicMenu(restaurantId: string, onChange: (reason: LiveReason, signal?: LiveSignal) => void, options: LiveOptions = {}) {
  const WS = options.WebSocketImpl || (typeof WebSocket === 'undefined' ? undefined : WebSocket)
  const now = options.now || Date.now
  const topic = 'realtime:menu-live:' + restaurantId
  let ws: WebSocket | null = null, joined = false, stopped = false, attempt = 0, ref = 0
  let reconnectTimer: any = null, heartbeatTimer: any = null, heartbeatDeadline: any = null, fallbackTimer: any = null, hiddenTimer: any = null
  let lastCheck = now(), closedWhileHidden = false, hiddenAt: number | null = null
  const visible = () => typeof document === 'undefined' || document.visibilityState !== 'hidden'
  const clear = (t: any) => { if (t) clearTimeout(t) }
  const send = (event: string, payload: unknown, channel = topic) => {
    if (ws?.readyState !== 1) return
    try { ws.send(JSON.stringify({ topic: channel, event, payload, ref: String(++ref), join_ref: channel === topic ? '1' : undefined })) } catch {}
  }
  const check = (reason: LiveReason, signal?: LiveSignal) => { lastCheck = now(); if (!stopped) onChange(reason, signal) }
  // Riserva: con il socket non agganciato, al massimo una lettura ogni 60 s (solo a scheda visibile).
  const armFallback = () => {
    clear(fallbackTimer); fallbackTimer = null
    if (stopped || joined || !visible()) return
    fallbackTimer = setTimeout(() => { fallbackTimer = null; if (!joined && visible() && now() - lastCheck >= FALLBACK_MS - 50) check('poll'); armFallback() }, Math.max(1000, FALLBACK_MS - (now() - lastCheck)))
  }
  const close = () => {
    joined = false; clear(heartbeatTimer); clear(heartbeatDeadline); heartbeatTimer = heartbeatDeadline = null
    const socket = ws; ws = null
    if (socket) { socket.onopen = socket.onmessage = socket.onclose = socket.onerror = null; try { socket.close() } catch {} }
  }
  const scheduleReconnect = () => {
    close(); armFallback()
    if (stopped || !visible() || reconnectTimer) return
    const base = BACKOFF_MS[Math.min(attempt, BACKOFF_MS.length - 1)]!; attempt++
    reconnectTimer = setTimeout(() => { reconnectTimer = null; connect() }, base * (0.7 + Math.random() * 0.6))
  }
  const beat = () => {
    clear(heartbeatTimer)
    heartbeatTimer = setTimeout(() => {
      send('heartbeat', {}, 'phoenix')
      clear(heartbeatDeadline); heartbeatDeadline = setTimeout(scheduleReconnect, HEARTBEAT_TIMEOUT_MS)
      beat()
    }, HEARTBEAT_MS)
  }
  const connect = () => {
    if (stopped || ws || !WS || !visible()) return
    let socket: WebSocket
    try { socket = new WS(`${options.url || REALTIME_URL}?apikey=${encodeURIComponent(options.key || PUBLISHABLE_KEY)}&vsn=1.0.0`) } catch { scheduleReconnect(); return }
    ws = socket
    socket.onopen = () => {
      send('phx_join', { config: { broadcast: { self: false, ack: false }, presence: { key: '', enabled: false }, postgres_changes: [], private: true }, access_token: options.key || PUBLISHABLE_KEY })
      beat()
    }
    socket.onmessage = event => {
      let message: any; try { message = JSON.parse(String(event.data)) } catch { return }
      if (message.topic === 'phoenix' && message.event === 'phx_reply') { clear(heartbeatDeadline); heartbeatDeadline = null; return }
      if (message.topic !== topic) return
      if (message.event === 'phx_reply' && message.payload?.status === 'ok' && !joined) {
        const wasDown = attempt > 0; joined = true; attempt = 0; clear(fallbackTimer); fallbackTimer = null
        // Dopo una caduta del socket qualcosa può essere cambiato senza segnale: una sola rilettura.
        if (wasDown) check('resume')
        return
      }
      if (message.event === 'phx_reply' && message.payload?.status === 'error') { scheduleReconnect(); return }
      if (message.event === 'phx_error' || message.event === 'phx_close' || message.event === 'system' && message.payload?.status === 'error') { scheduleReconnect(); return }
      if (message.event === 'broadcast' && message.payload?.event === 'v') check('push', message.payload?.payload && typeof message.payload.payload === 'object' ? message.payload.payload : undefined)
    }
    socket.onerror = () => scheduleReconnect()
    socket.onclose = () => scheduleReconnect()
  }
  const onVisibility = () => {
    if (stopped) return
    if (!visible()) {
      // Breve uscita dalla scheda: il socket resta; oltre 15 s si chiude (niente batteria in standby).
      hiddenAt = now()
      clear(fallbackTimer); fallbackTimer = null
      clear(hiddenTimer); hiddenTimer = setTimeout(() => { hiddenTimer = null; if (!visible()) { clear(reconnectTimer); reconnectTimer = null; close(); closedWhileHidden = true } }, HIDDEN_CLOSE_MS)
      return
    }
    clear(hiddenTimer); hiddenTimer = null
    // Telefono bloccato: i timer sono congelati e il socket può essere morto senza onclose. Oltre 15 s si riapre da capo.
    const away = hiddenAt === null ? 0 : now() - hiddenAt; hiddenAt = null
    if (away >= HIDDEN_CLOSE_MS && ws) { close(); clear(reconnectTimer); reconnectTimer = null; closedWhileHidden = true }
    // Ripresa: una sola rilettura se il socket era chiuso o non agganciato o la scheda è rimasta nascosta a lungo
    // (con lo schermo spento un segnale può essersi perso); poi ci si riaggancia.
    if (closedWhileHidden || !joined || away >= RESUME_CHECK_MS) { closedWhileHidden = false; check('resume') }
    if (!ws) { attempt = 0; connect() }
    armFallback()
  }
  const onOnline = () => { if (stopped || !visible()) return; check('resume'); if (!joined) { close(); clear(reconnectTimer); reconnectTimer = null; attempt = 0; connect() } }
  const onPageShow = (event: PageTransitionEvent) => { if (event.persisted) { closedWhileHidden = true; onVisibility() } }
  if (typeof document !== 'undefined') document.addEventListener('visibilitychange', onVisibility)
  if (typeof window !== 'undefined') { window.addEventListener('online', onOnline); window.addEventListener('pageshow', onPageShow) }
  connect(); armFallback()
  return () => {
    stopped = true; close(); clear(reconnectTimer); clear(fallbackTimer); clear(hiddenTimer)
    if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onVisibility)
    if (typeof window !== 'undefined') { window.removeEventListener('online', onOnline); window.removeEventListener('pageshow', onPageShow) }
  }
}

/** Ritardo casuale prima della rilettura: i telefoni dello stesso locale non arrivano tutti nello stesso istante. */
export function liveJitter(reason: LiveReason, random = Math.random) {
  // Cambio strutturale (senza delta): la rilettura È la modifica visibile → quasi subito (0–PUSH_JITTER_MS).
  if (reason === 'push') return Math.round(random() * PUSH_JITTER_MS)
  // Riconferma dopo un delta già applicato: nessuna fretta, 0,15–3,5 s (con 30 telefoni sullo stesso IP il contatore del limite regge ~10 letture/s).
  if (reason === 'reconcile') return 150 + Math.round(random() * 3350)
  return Math.round(random() * 800)
}
// Con la lettura condivisa nel Worker (gettone k) i telefoni partono insieme: il primo legge, gli altri aspettano la sua copia
// (carico 30 telefoni, 17/10: 0 × 429, 0 × 5xx, una lettura all'origine per cambio).
export const PUSH_JITTER_MS = 0

/**
 * Applica al menu a schermo il delta pubblicato, con le stesse regole di publicMenuProjection (lingua, ripiego sull'italiano,
 * nameLang/descriptionLang). Restituisce: la risposta nuova; la stessa se non cambia nulla a schermo; null se serve rileggere
 * (piatto da far comparire, Menu o Sottomenu svuotato da questo delta, delta non riconosciuto).
 */
export function applyLiveDelta(result: any, changes: LiveChange[], language: string) {
  const menu = result?.data
  if (!menu || !Array.isArray(menu.sections) || !Array.isArray(changes)) return null
  const source: string | undefined = result.defaultLanguage, lang = language || source, marking = !!lang && !!source && lang !== source
  const sections = menu.sections.map((s: any) => ({ ...s, items: Array.isArray(s.items) ? [...s.items] : [] }))
  let changed = false
  for (const c of changes) {
    if (!c || typeof c.i !== 'string') return null
    const visible = c.h !== true && c.a !== false
    let found = false
    for (const section of sections) {
      const index = section.items.findIndex((item: any) => item?.id === c.i)
      if (index < 0) continue
      found = true
      if (!visible) { section.items.splice(index, 1); if (typeof c.n !== 'string') section.deleted = true; changed = true; break }
      if (typeof c.n !== 'string' || typeof c.p !== 'number') return null
      const old = section.items[index], t = lang && c.t && typeof c.t === 'object' ? c.t[lang] : undefined
      const { id, name: _name, description: _description, nameLang: _nameLang, descriptionLang: _descriptionLang, price: _price, ...rest } = old
      const next = { id, name: t?.name || c.n, description: t?.description ?? c.ds ?? undefined,
        ...(marking && !t?.name && c.n ? { nameLang: source } : {}), ...(marking && t?.description == null && c.ds ? { descriptionLang: source } : {}),
        price: c.p, ...rest }
      if (JSON.stringify(next) !== JSON.stringify(old)) { section.items[index] = next; changed = true }
      break
    }
    // Piatto che deve comparire in questo menu: servono i suoi dati completi → rilettura.
    if (!found && visible && (c.m === undefined || c.m === menu.id)) return null
  }
  // Regola 21/10: un Menu/Sottomenu vuoto nel documento resta visibile («Menu in arrivo», flag empty dal server); uno rimasto
  // senza piatti per esauriti/nascosti sparisce (Menu) o resta senza riga (Sottomenu).
  // Rilettura solo se QUESTO delta svuota: l'intero menu (il server lo toglie o lo segna «in arrivo»), oppure un Sottomenu con
  // un piatto eliminato dal documento (delta senza nome: potrebbe diventare «in arrivo»). Un menu già vuoto, o con Sottomenu
  // già vuoti, non provoca riletture a ogni delta di altri menu.
  const emptied = sections.map((s: any, index: number) => Array.isArray(menu.sections[index].items) && menu.sections[index].items.length > 0 && !s.items.length)
  if (emptied.some(Boolean) && !sections.some((s: any) => s.items.length)) return null
  if (sections.some((s: any, index: number) => emptied[index] && s.deleted)) return null
  for (const s of sections) delete s.deleted
  return changed ? { ...result, data: { ...menu, sections } } : result
}

/** Primo elemento leggibile sotto l'header fisso: serve a mantenere il punto di lettura dopo un aggiornamento. */
export function readingAnchor(): { ids: string[]; tops: number[] } | null {
  if (typeof document === 'undefined' || window.scrollY < 1) return null
  const header = document.querySelector('[data-menu-sticky-header]')?.getBoundingClientRect().bottom || 0
  // I piatti prima delle sezioni: la sezione che contiene il punto di lettura non si sposta quando cambia un piatto sopra.
  const items = [...document.querySelectorAll<HTMLElement>('[data-item-id]')]
  const rows = items.length ? items : [...document.querySelectorAll<HTMLElement>('section[id^="workspace-section-"]')]
  const ids: string[] = [], tops: number[] = []
  for (const row of rows) {
    const rect = row.getBoundingClientRect()
    if (rect.bottom <= header) continue
    ids.push(row.dataset.itemId ? 'i:' + row.dataset.itemId : 's:' + row.id); tops.push(rect.top)
    if (ids.length >= 6) break
  }
  return ids.length ? { ids, tops } : null
}

/** Dopo il nuovo render riporta il primo elemento ancora presente alla stessa altezza sullo schermo. */
export function restoreReadingAnchor(anchor: { ids: string[]; tops: number[] } | null) {
  if (!anchor || typeof document === 'undefined') return 0
  for (const [index, id] of anchor.ids.entries()) {
    const element = id.startsWith('i:') ? document.querySelector<HTMLElement>(`[data-item-id="${CSS.escape(id.slice(2))}"]`) : document.getElementById(id.slice(2))
    if (!element) continue
    const delta = element.getBoundingClientRect().top - anchor.tops[index]!
    if (Math.abs(delta) >= 0.5) window.scrollTo({ top: window.scrollY + delta, behavior: 'instant' as ScrollBehavior })
    return delta
  }
  return 0
}
