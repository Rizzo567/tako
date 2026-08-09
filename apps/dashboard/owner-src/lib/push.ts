// Notifiche push lato app (F3.3).
//
// Tre cose che qui non sono dettagli:
//
//  • IL PERMESSO NON SI CHIEDE ALL'APERTURA. `Notification.requestPermission()` si
//    può invocare una volta sola per installazione: se l'utente dice no, non c'è
//    modo di richiederlo da codice — deve andarlo a cambiare nelle impostazioni di
//    sistema. Chiedere davanti a una schermata vuota è il modo più veloce di
//    bruciare quell'unica occasione. Si chiede DOPO il primo evento vero (un ordine,
//    una chiamata) o quando è il ristoratore a cercarlo in "Altro".
//  • SU iOS SERVE LA PWA SULLA SCHERMATA HOME. Fino a iOS 16.4 Web Push non esiste;
//    da lì in poi esiste SOLO per le PWA installate. In Safari `PushManager` non è
//    nemmeno definito finché l'app non è in standalone: non c'è niente da chiedere,
//    c'è da spiegare come si installa.
//  • LA SUBSCRIPTION SEGUE LA SESSIONE. Il server la lega alla sessione mobile
//    (CASCADE): dopo un ri-arruolamento la vecchia riga è sparita, quindi all'avvio
//    si ri-registra sempre la subscription già presente nel browser (`syncPush`).
import type { Api } from './api'

/** Gli stati che l'interfaccia deve saper raccontare. Nessuno di questi è un errore. */
export type PushState =
  | 'unsupported'    // niente Web Push in questo browser (o http:// puro senza SW)
  | 'needs-install'  // iOS/iPadOS: la PWA non è sulla schermata Home
  | 'default'        // si può chiedere il permesso
  | 'granted'        // permesso dato
  | 'denied'         // permesso negato: da qui in poi si cambia solo dalle impostazioni

export function isIOS(): boolean {
  const ua = navigator.userAgent
  // iPadOS 13+ si presenta come Macintosh: il touch è l'unico modo di distinguerlo.
  return /iPhone|iPad|iPod/i.test(ua) || (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1)
}

/** La PWA è aperta dalla schermata Home (o come app installata) e non dal browser? */
export function isStandalone(): boolean {
  const iosStandalone = (navigator as Navigator & { standalone?: boolean }).standalone === true
  let displayMode = false
  try { displayMode = window.matchMedia('(display-mode: standalone)').matches } catch { /* matchMedia esotico */ }
  return iosStandalone || displayMode
}

export function pushSupported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

export function pushState(): PushState {
  if (!pushSupported()) return isIOS() && !isStandalone() ? 'needs-install' : 'unsupported'
  // Anche con le API presenti, su iOS fuori standalone la subscribe fallisce sempre.
  if (isIOS() && !isStandalone()) return 'needs-install'
  const p = Notification.permission
  return p === 'granted' ? 'granted' : p === 'denied' ? 'denied' : 'default'
}

/**
 * base64url (come arriva dal server) → `Uint8Array<ArrayBuffer>`, la forma che vuole
 * `applicationServerKey`. Il buffer si alloca esplicitamente: un `Uint8Array` generico
 * ha per TypeScript un `ArrayBufferLike` che potrebbe essere condiviso, e `BufferSource`
 * non lo accetta.
 */
function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padded = (base64 + '='.repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(padded)
  const out = new Uint8Array(new ArrayBuffer(raw.length))
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

function subJson(sub: PushSubscription): { endpoint: string; keys: { p256dh: string; auth: string } } | null {
  const json = sub.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } }
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return null
  return { endpoint: json.endpoint, keys: { p256dh: json.keys.p256dh, auth: json.keys.auth } }
}

async function registration(): Promise<ServiceWorkerRegistration | null> {
  try { return await navigator.serviceWorker.ready } catch { return null }
}

/**
 * Chiede il permesso, si iscrive e registra la subscription sull'appliance.
 * Ritorna lo stato risultante: chi chiama disegna l'esito, non gestisce eccezioni.
 */
export async function enablePush(api: Api): Promise<PushState> {
  const state = pushState()
  if (state !== 'default' && state !== 'granted') return state

  let permission = Notification.permission
  if (permission === 'default') {
    try { permission = await Notification.requestPermission() } catch { return 'denied' }
  }
  if (permission !== 'granted') return 'denied'

  try {
    const reg = await registration()
    if (!reg) return 'unsupported'

    const { publicKey } = await api.get<{ publicKey: string }>('/push/key')
    // Una subscription già esistente si RIUSA: `subscribe()` con una chiave diversa
    // da quella in corso lancia InvalidStateError invece di sostituirla.
    const existing = await reg.pushManager.getSubscription()
    const sub = existing ?? await reg.pushManager.subscribe({
      // Obbligatorio su Chrome: una push "silenziosa" non è ammessa.
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    })

    const body = subJson(sub)
    if (!body) return 'unsupported'
    await api.post('/push/subscribe', body)
    return 'granted'
  } catch {
    // Chiave VAPID assente (503), rete giù, push service irraggiungibile: il permesso
    // resta dato e `syncPush` riproverà al prossimo avvio. Niente da mostrare come errore.
    return Notification.permission === 'granted' ? 'granted' : 'default'
  }
}

/** Spegne le notifiche su QUESTO telefono: disiscrive il browser e cancella la riga. */
export async function disablePush(api: Api): Promise<void> {
  try {
    const reg = await registration()
    const sub = await reg?.pushManager.getSubscription()
    if (sub) {
      const body = subJson(sub)
      await sub.unsubscribe().catch(() => false)
      if (body) await api.del(`/push/subscribe?endpoint=${encodeURIComponent(body.endpoint)}`).catch(() => null)
      return
    }
    // Nessuna subscription nel browser: cancella comunque quelle di questo dispositivo
    // (un ri-arruolamento può aver lasciato righe orfane lato server).
    await api.del('/push/subscribe').catch(() => null)
  } catch { /* spegnere le notifiche non può fallire in modo rumoroso */ }
}

/** true se questo browser ha una subscription attiva adesso. */
export async function hasSubscription(): Promise<boolean> {
  try {
    const reg = await registration()
    return !!(await reg?.pushManager.getSubscription())
  } catch {
    return false
  }
}

/**
 * All'avvio: se il permesso c'è già e il browser ha una subscription, la ri-registra
 * sull'appliance. È un UPSERT lato server, quindi costa una riga di DB e chiude il
 * buco più insidioso: telefono ri-arruolato → subscription cancellata dal CASCADE →
 * notifiche mute per sempre, senza nessun errore da nessuna parte.
 */
export async function syncPush(api: Api): Promise<void> {
  try {
    if (pushState() !== 'granted') return
    const reg = await registration()
    const sub = await reg?.pushManager.getSubscription()
    if (!sub) return
    const body = subJson(sub)
    if (body) await api.post('/push/subscribe', body).catch(() => null)
  } catch { /* best-effort: mai bloccare l'avvio dell'app per una notifica */ }
}
