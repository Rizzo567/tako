// Sessione del telefono arruolato (F2.1 lato client).
//
// Il token è un Bearer opaco da 30 giorni emesso da POST /api/auth/device/enroll.
// Vive in localStorage e viaggia SOLO nell'header Authorization: mai in un cookie,
// perché l'app parla con due origini diverse (LAN http e tunnel https) e un cookie
// non sopravvive a quel salto.

export interface SessionUser {
  id: string
  name: string
  email: string
  role: string
}

export interface SessionRestaurant {
  id: string
  name: string
  slug: string
}

export interface Session {
  token: string
  deviceId: string
  expiresAt: string
  user: SessionUser
  restaurant: SessionRestaurant | null
}

const LS_SESSION = 'tako.owner.session'

export function loadSession(): Session | null {
  try {
    const raw = localStorage.getItem(LS_SESSION)
    if (!raw) return null
    const s = JSON.parse(raw) as Session
    return s && typeof s.token === 'string' && s.token.length > 20 ? s : null
  } catch {
    return null
  }
}

export function saveSession(s: Session): void {
  try { localStorage.setItem(LS_SESSION, JSON.stringify(s)) } catch { /* best-effort */ }
}

export function clearSession(): void {
  try { localStorage.removeItem(LS_SESSION) } catch { /* best-effort */ }
}

/**
 * Legge il codice di arruolamento dal FRAGMENT dell'URL (`#enroll=…`) e lo RIMUOVE
 * subito dalla barra degli indirizzi. Il fragment non viene mai inviato al server:
 * è il motivo per cui il QR lo mette lì e non in una query string.
 */
export function takeEnrollCodeFromUrl(): string | null {
  const hash = window.location.hash || ''
  const m = /[#&]enroll=([^&]+)/.exec(hash)
  if (!m?.[1]) return null
  const code = decodeURIComponent(m[1])
  try {
    history.replaceState(null, '', window.location.pathname + window.location.search)
  } catch { /* replaceState può fallire in contesti esotici: non è fatale */ }
  return code
}

/** Nome del dispositivo proposto al server: quello che l'owner leggerà in "Dispositivi". */
export function guessDeviceName(): string {
  const ua = navigator.userAgent
  if (/iPhone/i.test(ua)) return 'iPhone'
  if (/iPad/i.test(ua)) return 'iPad'
  if (/Android/i.test(ua)) return 'Telefono Android'
  if (/Macintosh/i.test(ua)) return 'Mac'
  if (/Windows/i.test(ua)) return 'PC Windows'
  return 'Telefono'
}

export function guessPlatform(): string {
  const ua = navigator.userAgent
  if (/iPhone|iPad|iPod/i.test(ua)) return 'iOS'
  if (/Android/i.test(ua)) return 'Android'
  if (/Macintosh/i.test(ua)) return 'macOS'
  if (/Windows/i.test(ua)) return 'Windows'
  return 'Web'
}

/** Riscatta il codice sull'endpoint indicato. Lancia con un messaggio leggibile. */
export async function enrollDevice(base: string, code: string): Promise<Session> {
  const res = await fetch(`${base}/api/auth/device/enroll`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, deviceName: guessDeviceName(), platform: guessPlatform() }),
  })
  const json = await res.json().catch(() => null)
  if (!res.ok) {
    throw new Error(json?.error?.message ?? 'Codice non valido o scaduto. Genera un nuovo QR dalla dashboard.')
  }
  const s = json.data as Session
  saveSession(s)
  return s
}
