// Cache in memoria (solo scheda corrente) delle risposte del menu pubblico.
// Un menu già visto si mostra subito e viene sempre riconfermato dal server: prezzi e
// disponibilità mostrati restano quelli dell'ultima risposta reale, mai dati più vecchi della sessione.
type Response = Record<string, any>
const values = new Map<string, Response>(), inflight = new Map<string, Promise<Response>>()
const key = (restaurantId: string, menuId = '', lang = '') => `${restaurantId}|${menuId}|${lang}`
const RETRY = [429, 502, 503, 504]

async function request(restaurantId: string, menuId: string, lang: string, prefetch: boolean, signal?: AbortSignal) {
  const query = new URLSearchParams()
  if (menuId) query.set('menuId', menuId)
  if (lang) query.set('lang', lang)
  // I prefetch non contano come visite nelle statistiche.
  if (prefetch) query.set('prefetch', '1')
  for (let attempt = 0; ; attempt++) {
    const response = await fetch(`/api/customer/restaurant/${encodeURIComponent(restaurantId)}/menu?${query}`, { signal })
    if (response.ok) return await response.json() as Response
    if (!RETRY.includes(response.status) || attempt === 2) throw Error('Menu non disponibile')
    await new Promise(resolve => setTimeout(resolve, 400 * (attempt + 1)))
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
  }
}

function store(restaurantId: string, menuId: string, lang: string, data: Response) {
  values.set(key(restaurantId, menuId, lang), data)
  // La risposta di default è anche quella del suo menu e della lingua predefinita.
  const realMenu = data?.data?.id || menuId, realLang = lang || data?.defaultLanguage || ''
  values.set(key(restaurantId, realMenu, realLang), data)
  if (!lang) values.set(key(restaurantId, realMenu, ''), data)
}

/** Ultima risposta nota per questa combinazione, se c'è. */
export function cachedMenu(restaurantId: string, menuId = '', lang = '') {
  return values.get(key(restaurantId, menuId, lang))
}

/** Richiesta deduplicata: chiamate uguali in volo condividono la stessa risposta. */
export function loadMenu(restaurantId: string, menuId = '', lang = '', options: { prefetch?: boolean; signal?: AbortSignal } = {}) {
  const k = key(restaurantId, menuId, lang) + (options.prefetch ? '|p' : '')
  const running = inflight.get(k)
  if (running) return running
  const promise = request(restaurantId, menuId, lang, !!options.prefetch, options.signal)
    .then(data => { store(restaurantId, menuId, lang, data); return data })
    .finally(() => inflight.delete(k))
  inflight.set(k, promise)
  return promise
}

/** Precarica in idle gli altri menu del locale nella lingua corrente (massimo due). */
export function prefetchSiblingMenus(restaurantId: string, menus: { id: string }[], currentMenuId: string, lang: string) {
  const idle = (fn: () => void) => typeof (globalThis as any).requestIdleCallback === 'function' ? (globalThis as any).requestIdleCallback(fn, { timeout: 2000 }) : setTimeout(fn, 600)
  idle(() => {
    for (const menu of menus.filter(m => m.id !== currentMenuId).slice(0, 2))
      if (!cachedMenu(restaurantId, menu.id, lang)) loadMenu(restaurantId, menu.id, lang, { prefetch: true }).catch(() => {})
  })
}

/** Prefetch ancora in volo per questa combinazione, se c'è (per mostrarlo appena arriva). */
export function pendingPrefetch(restaurantId: string, menuId = '', lang = '') {
  return inflight.get(key(restaurantId, menuId, lang) + '|p')
}

/** Precarica un menu in un'altra lingua: subito (tocco sulla bandiera) o in idle. */
export function prefetchMenu(restaurantId: string, menuId: string, lang: string, idle = false) {
  const run = () => { if (!cachedMenu(restaurantId, menuId, lang) && !pendingPrefetch(restaurantId, menuId, lang)) loadMenu(restaurantId, menuId, lang, { prefetch: true }).catch(() => {}) }
  if (!idle) return run()
  if (typeof (globalThis as any).requestIdleCallback === 'function') (globalThis as any).requestIdleCallback(run, { timeout: 3000 })
  else setTimeout(run, 1200)
}
