// ─────────────────────────── Tako — RILEVATORE CONNETTIVITÀ INTERNET ───────────────────────────
// Sonda periodicamente se il Mac ha accesso a INTERNET (non alla LAN: la LAN è sempre locale).
// Serve a due cose:
//  1) mostrare uno stato "offline" chiaro su dashboard e PWA invece di errori/spinner infiniti;
//  2) fare FAST-FAIL sulle funzioni che richiedono internet (foto AI, copilot, ecc.) così non
//     restano appese fino al timeout quando internet è giù.
// Il CORE (ordini/conti/menu/cucina/staff/realtime LAN) NON dipende da questo: gira comunque.
type ConnState = { online: boolean; since: number; checkedAt: number }

// Endpoint di prova: risponde 204 senza corpo, veloce e senza cache (override via env).
const CHECK_URL = process.env['CONNECTIVITY_CHECK_URL']?.trim() || 'https://www.gstatic.com/generate_204'
const CHECK_INTERVAL_MS = Number(process.env['CONNECTIVITY_INTERVAL_MS'] ?? 30_000)
const PROBE_TIMEOUT_MS = 4_000

let state: ConnState = { online: true, since: Date.now(), checkedAt: 0 }
let timer: ReturnType<typeof setInterval> | null = null
const listeners = new Set<(online: boolean) => void>()

async function probe(): Promise<boolean> {
  const ac = new AbortController()
  const to = setTimeout(() => ac.abort(), PROBE_TIMEOUT_MS)
  try {
    const r = await fetch(CHECK_URL, { method: 'GET', signal: ac.signal, redirect: 'manual' })
    return r.status === 204 || r.ok
  } catch {
    return false
  } finally {
    clearTimeout(to)
  }
}

async function tick(): Promise<void> {
  const online = await probe()
  const now = Date.now()
  const changed = online !== state.online
  state = { online, since: changed ? now : state.since, checkedAt: now }
  if (changed) for (const l of listeners) { try { l(online) } catch { /* noop */ } }
}

/** true se l'ultimo probe ha visto internet. Sincrono: usalo per il fast-fail. */
export function isOnline(): boolean {
  return state.online
}

/** Stato completo per l'endpoint/UI. */
export function getConnectivity(): ConnState {
  return { ...state }
}

/** Registra un callback chiamato SOLO quando lo stato cambia (online↔offline). */
export function onConnectivityChange(fn: (online: boolean) => void): void {
  listeners.add(fn)
}

/** Avvia il monitor (idempotente). Primo probe subito, poi ogni CHECK_INTERVAL_MS. */
export function startConnectivityMonitor(): void {
  if (timer) return
  void tick()
  timer = setInterval(() => void tick(), CHECK_INTERVAL_MS)
  if (typeof timer.unref === 'function') timer.unref()
}
