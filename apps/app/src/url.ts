// Manipolazione degli indirizzi dell'appliance — SENZA alcuna dipendenza.
//
// Sta in un file suo, separato da `endpoint.ts`, per una ragione pratica: è l'unica
// parte del guscio nativo collaudabile senza un simulatore. `endpoint.ts` importa
// AsyncStorage e `react-native`, che fuori da un device non si caricano; qui non
// c'è un solo import, quindi `scripts/test-url.mjs` la esercita in Node puro
// (verifier di F7.2). Le regressioni su questi quattro casi costerebbero un giro
// completo di build native per essere scoperte.

/** Porta dell'appliance: se l'utente scrive solo l'host, è questa che intendeva. */
export const DEFAULT_PORT = 4317

/**
 * Porta qualunque cosa l'utente abbia digitato nella forma `schema://host:porta`.
 *
 * Non si usa `new URL`: l'implementazione di React Native è parziale e su un input
 * incompleto come `10.0.2.2:4317` interpreta `10.0.2.2` come SCHEMA. Qui si fa a
 * mano, che su una stringa così corta è più prevedibile.
 */
export function normalizeBase(raw: string | null | undefined): string | null {
  let v = String(raw ?? '').trim()
  if (!v) return null
  if (!/^https?:\/\//i.test(v)) v = `http://${v}`

  const m = /^(https?):\/\/([^/?#]+)([^?#]*)/i.exec(v)
  if (!m) return null

  const scheme = m[1]!.toLowerCase()
  let authority = m[2]!
  const path = (m[3] ?? '').replace(/\/+$/, '')
  if (!authority) return null

  // Solo l'host, senza porta: è quasi sempre l'appliance, che sta sulla 4317. In
  // https la porta si lascia stare — il tunnel gira sulla 443.
  const hasPort = /:\d+$/.test(authority)
  if (!hasPort && scheme === 'http') authority = `${authority}:${DEFAULT_PORT}`

  return `${scheme}://${authority}${path}`
}

/** Origine (schema + host + porta): è ciò che si dà alla whitelist della WebView. */
export function originOf(baseUrl: string): string {
  const m = /^(https?:\/\/[^/?#]+)/i.exec(baseUrl)
  return m ? m[1]! : baseUrl
}

/**
 * Codice di arruolamento dentro un deep link `tako://…`.
 *
 * Sta nel FRAGMENT (`#enroll=…`) esattamente come nel QR generato dal desktop
 * (`apps/server/src/routes/auth.ts` → `${lan}/owner/#enroll=${code}`): il fragment
 * non viene mai inviato a un server. Si accetta anche in query string perché un
 * lettore di QR può riscrivere l'URL.
 */
export function enrollFromDeepLink(url: string | null | undefined): string | null {
  if (!url) return null
  const m = /[#?&]enroll=([^&#]+)/.exec(url)
  if (!m?.[1]) return null
  try {
    return decodeURIComponent(m[1])
  } catch {
    return m[1] // percent-encoding malformato: meglio il valore grezzo che niente
  }
}

/**
 * Endpoint imparati dalla PWA: la WebView rilancia al nativo il contenuto di
 * `localStorage['tako.owner.endpoints']`, scritto da `learnEndpoints()` di
 * `owner-src/lib/endpoint.ts` quando l'app interroga `/api/system/info`. Così il
 * guscio conosce l'indirizzo del tunnel senza duplicare quella chiamata — che
 * peraltro non potrebbe fare, non avendo il token di sessione.
 */
export function parseLearnedEndpoints(payload: unknown): { lan: string | null; remote: string | null } | null {
  if (!payload || typeof payload !== 'object') return null
  const p = payload as { lan?: unknown; remote?: unknown }
  const lan = typeof p.lan === 'string' ? normalizeBase(p.lan) : null
  const remote = typeof p.remote === 'string' ? normalizeBase(p.remote) : null
  if (!lan && !remote) return null
  return { lan, remote }
}
