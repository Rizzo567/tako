// ───────────── Tako Owner (guscio nativo) — SELEZIONE DELL'ENDPOINT ─────────────
//
// Porta su React Native della logica di `apps/dashboard/owner-src/lib/endpoint.ts`
// (F1.4). Stessa cascata, stesse priorità, ma con le due differenze che il nativo
// impone:
//
//   • la persistenza è AsyncStorage, non `localStorage` (che qui non esiste);
//   • esiste un HOST MANUALE. Sul telefono vero `tako.local` basta, ma un
//     emulatore Android non vede né l'mDNS né la LAN del Mac: raggiunge l'host
//     solo su `10.0.2.2`, e il Simulatore iOS su `localhost`. Senza campo host
//     l'app non sarebbe collaudabile su nessuno dei due (vincolo di F7.4).
//
// Ordine di risoluzione — LAN-FIRST, esattamente come nella PWA:
//
//   (1) host manuale salvato   se il ristoratore/lo sviluppatore ne ha imposto uno
//   (2) http://tako.local:4317 la LAN, ~5 ms, funziona anche con internet giù
//   (3) remoto (tunnel)        solo se l'appliance ce l'ha fatto sapere
//   (4) nessuno                → schermata nativa di collegamento
//
// Nota che lega questo file al gate di F1.3: sull'hostname pubblico il server
// risponde 404 a tutto ciò che non porta una sessione valida, `/health` compreso.
// Il guscio nativo NON possiede il token (vive in `localStorage` dentro la WebView),
// quindi il probe remoto qui è di fatto una verifica di raggiungibilità del tunnel:
// se risponde 404 il tunnel è su, ed è comunque l'unico posto dove valga la pena
// mandare la WebView. Per questo il probe remoto accetta anche il 404 — vedi
// `probeRemote`.

import AsyncStorage from '@react-native-async-storage/async-storage'
import Constants from 'expo-constants'
import { Platform } from 'react-native'
import { DEFAULT_PORT, normalizeBase } from './url'

// Le funzioni pure sugli URL vivono in `./url` (nessun import, quindi collaudabili
// in Node puro) e si ri-esportano da qui: per chi consuma il modulo l'endpoint
// resta un posto solo.
export { DEFAULT_PORT, enrollFromDeepLink, normalizeBase, originOf, parseLearnedEndpoints } from './url'

/** LAN via mDNS: l'indirizzo che l'appliance annuncia da sola. */
export const LAN_DEFAULT = `http://tako.local:${DEFAULT_PORT}`

/** Timeout del probe LAN (piano F1.4). */
export const LAN_PROBE_TIMEOUT_MS = 1200
/** L'host manuale è spesso un IP scritto a mano: gli si concede un filo in più. */
export const MANUAL_PROBE_TIMEOUT_MS = 2500
/** Il remoto passa da internet: più respiro che alla LAN. */
export const REMOTE_PROBE_TIMEOUT_MS = 4000

export type EndpointKind = 'manual' | 'lan' | 'remote'

export interface Endpoint {
  kind: EndpointKind
  /** Base URL senza slash finale, es. `http://tako.local:4317`. */
  baseUrl: string
}

export interface StoredConfig {
  /** Host imposto a mano (emulatore, IP fisso, porta diversa). null = automatico. */
  manual: string | null
  /** Base URL del tunnel, imparata dalla PWA dentro la WebView. null = LAN-only. */
  remote: string | null
}

const STORAGE_KEY = 'tako.app.endpoint'

// ─────────────────────────── Persistenza ───────────────────────────

export async function loadConfig(): Promise<StoredConfig> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY)
    const saved = raw ? (JSON.parse(raw) as Partial<StoredConfig>) : null
    return {
      manual: normalizeBase(saved?.manual),
      remote: normalizeBase(saved?.remote),
    }
  } catch {
    return { manual: null, remote: null } // storage corrotto: non è un errore fatale
  }
}

export async function saveConfig(patch: Partial<StoredConfig>): Promise<StoredConfig> {
  const current = await loadConfig()
  const next: StoredConfig = {
    manual: 'manual' in patch ? normalizeBase(patch.manual) : current.manual,
    remote: 'remote' in patch ? normalizeBase(patch.remote) : current.remote,
  }
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    /* best-effort: in RAM la scelta vale comunque per questa sessione */
  }
  return next
}

// ─────────────────────────── Probe ───────────────────────────

async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response | null> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    return await fetch(url, { method: 'GET', signal: ctrl.signal, headers: { 'Cache-Control': 'no-store' } })
  } catch {
    return null // timeout, DNS, rete assente: per noi è tutto "non raggiungibile"
  } finally {
    clearTimeout(timer)
  }
}

/**
 * `GET {base}/health` con timeout esplicito. In LAN `/health` è pubblico e
 * risponde 200. Non lancia mai: risponde solo sì/no.
 */
export async function probe(base: string, timeoutMs: number): Promise<boolean> {
  const res = await fetchWithTimeout(`${base}/health`, timeoutMs)
  return res != null && res.ok
}

/**
 * Probe dell'endpoint REMOTO. Il gate di F1.3 risponde 404 a chi arriva
 * dall'hostname pubblico senza sessione — e il guscio nativo una sessione non ce
 * l'ha (il token sta in `localStorage`, dentro la WebView). Un 404 quindi non
 * significa "non c'è": significa "il tunnel è su e mi sta chiedendo le
 * credenziali", che è tutto ciò che serve sapere per mandarci la WebView, la
 * quale il token ce l'ha. Restano fuori solo i veri fallimenti di rete e i 5xx.
 */
export async function probeRemote(base: string, timeoutMs = REMOTE_PROBE_TIMEOUT_MS): Promise<boolean> {
  const res = await fetchWithTimeout(`${base}/health`, timeoutMs)
  return res != null && res.status < 500
}

// ─────────────────────────── Selezione ───────────────────────────

/** Override da build/env, utile in sviluppo: vince su tutto e non viene sondato. */
export function configuredOverride(): string | null {
  const extra = (Constants.expoConfig?.extra ?? {}) as { serverUrl?: string }
  return normalizeBase(extra.serverUrl ?? process.env.EXPO_PUBLIC_SERVER_URL ?? null)
}

/**
 * Sceglie l'endpoint da usare ORA, LAN-first. Ritorna `null` quando nessun
 * candidato risponde: è il segnale per mostrare la schermata di collegamento.
 */
export async function resolveEndpoint(cfg: StoredConfig): Promise<Endpoint | null> {
  if (cfg.manual && (await probe(cfg.manual, MANUAL_PROBE_TIMEOUT_MS))) {
    return { kind: 'manual', baseUrl: cfg.manual }
  }
  // LAN sempre prima del remoto: 5 ms contro un giro su internet, e funziona
  // anche quando il locale è senza uplink.
  if (await probe(LAN_DEFAULT, LAN_PROBE_TIMEOUT_MS)) {
    return { kind: 'lan', baseUrl: LAN_DEFAULT }
  }
  if (cfg.remote && (await probeRemote(cfg.remote))) {
    return { kind: 'remote', baseUrl: cfg.remote }
  }
  return null
}

// ─────────────────────── Suggerimenti per la schermata ───────────────────────

export interface HostSuggestion {
  label: string
  value: string
  hint: string
}

/**
 * Host da proporre con un tocco nella schermata di collegamento. Le voci per
 * emulatore/simulatore compaiono SOLO in sviluppo: a un ristoratore `10.0.2.2`
 * non dice nulla e sarebbe solo un modo per rompersi l'app da soli.
 */
export function hostSuggestions(): HostSuggestion[] {
  const list: HostSuggestion[] = [
    { label: 'tako.local', value: `tako.local:${DEFAULT_PORT}`, hint: 'Il computer del locale sulla stessa rete WiFi' },
  ]
  if (__DEV__) {
    if (Platform.OS === 'android') {
      list.push({ label: '10.0.2.2', value: `10.0.2.2:${DEFAULT_PORT}`, hint: 'Emulatore Android → Mac di sviluppo' })
    }
    if (Platform.OS === 'ios') {
      list.push({ label: 'localhost', value: `localhost:${DEFAULT_PORT}`, hint: 'Simulatore iOS → Mac di sviluppo' })
    }
  }
  return list
}
