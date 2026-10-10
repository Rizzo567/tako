// Sessione del telefono arruolato — versione NATIVA (port di owner-src/lib/session.ts).
//
// Stesso token Bearer opaco da 30 giorni di POST /api/auth/device/enroll, ma la
// persistenza è AsyncStorage: il guscio nativo non ha localStorage. La chiave è
// DIVERSA da quella della WebView (`tako.owner.session`): le due sessioni sono
// dispositivi distinti agli occhi del server e revocabili separatamente — però il
// guscio sa IMPORTARE quella della WebView (vedi il bridge in app/index.tsx), così
// chi si è già arruolato via QR non rifà nulla.
import AsyncStorage from '@react-native-async-storage/async-storage'
import { Platform } from 'react-native'

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

const KEY = 'tako.app.session'

export function isSession(v: unknown): v is Session {
  const s = v as Session | null
  return !!s && typeof s.token === 'string' && s.token.length > 20 && !!s.user
}

export async function loadNativeSession(): Promise<Session | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY)
    if (!raw) return null
    const s = JSON.parse(raw) as unknown
    return isSession(s) ? s : null
  } catch {
    return null
  }
}

export async function saveNativeSession(s: Session): Promise<void> {
  try { await AsyncStorage.setItem(KEY, JSON.stringify(s)) } catch { /* best-effort */ }
}

export async function clearNativeSession(): Promise<void> {
  try { await AsyncStorage.removeItem(KEY) } catch { /* best-effort */ }
}

function deviceName(): string {
  return Platform.OS === 'ios' ? 'iPhone (app)' : 'Telefono Android (app)'
}

/** Riscatta il codice di arruolamento sull'endpoint indicato. Lancia con messaggio leggibile. */
export async function enrollNative(base: string, code: string): Promise<Session> {
  const res = await fetch(`${base}/api/auth/device/enroll`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, deviceName: deviceName(), platform: Platform.OS === 'ios' ? 'iOS' : 'Android' }),
  })
  const json = (await res.json().catch(() => null)) as { data?: unknown; error?: { message?: string } } | null
  if (!res.ok || !isSession(json?.data)) {
    throw new Error(json?.error?.message ?? 'Codice non valido o scaduto. Genera un nuovo QR dalla dashboard.')
  }
  const s = json.data
  await saveNativeSession(s)
  return s
}
