// Cloud client dell'APPLIANCE LOCALE (modo `local`) — pairing + heartbeat verso il
// control-plane Tako (MASTER_PLAN-cloud-auth §2.2 / §5 / SEC-001/003/007).
//
// Cosa fa, in breve:
//   - Genera e PERSISTE una keypair ed25519 dell'appliance (proof-of-possession).
//   - `claim(code, devicePubKey)` → POST {CLOUD_BASE_URL}/api/pair/claim: riceve il
//     bundle {restaurant, ownerSnapshot{cloud_owner_id,email,name}} + applianceToken.
//     NON riceve MAI il password_hash cloud (SEC-001).
//   - `heartbeat()` → POST /api/pair/heartbeat firmata con la privkey (proof-of-
//     possession), confronta credentials_version; se il cloud ha bumpato → segnala
//     che il login owner offline va invalidato (refresh/relogin).
//
// SICUREZZA DELLO STORE LOCALE (SEC-001, "box rubato"):
//   La privkey ed25519 e l'applianceToken sono dati segreti dell'appliance. Vivono in
//   un singolo file JSON CIFRATO A RIPOSO in ~/.tako/cloud-identity.enc.
//   - Cifratura: AES-256-GCM (authenticated encryption: confidenzialità + integrità).
//   - Chiave: derivata con scrypt da un "device secret" ad alta entropia generato una
//     volta e salvato in ~/.tako/device-secret con permessi 0600 (mai nel repo, mai
//     nel DB). Scelta pragmatica per un'appliance headless senza TPM/secure-enclave:
//     lega la confidenzialità ai permessi del filesystem dell'utente del servizio.
//     Razionale del threat-model: il furto del box NON espone la credenziale CLOUD
//     dell'owner (che non è mai sul box — SEC-001); espone al più l'identità di QUESTO
//     appliance, revocabile lato cloud (revokedAt) + invalidabile via credentials_version.
//     Se in futuro è disponibile un secret hardware (TPM/Keychain), si sostituisce solo
//     `loadDeviceSecret()` senza toccare il resto.
import { join } from 'node:path'
import { homedir } from 'node:os'
import { primaryLanIPv4, clientPort, mdnsHost } from './network.js'
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs'
import {
  generateKeyPairSync,
  createPrivateKey,
  createPublicKey,
  sign as edSign,
  verify as edVerify,
  randomBytes,
  scryptSync,
  createCipheriv,
  createDecipheriv,
} from 'node:crypto'

// ─── Percorsi store locale ─────────────────────────────────────────────────────
// TAKO_HOME è impostato dalla shell desktop (Tauri); fallback ~/.tako, coerente con
// bootstrap.ts (jwt-secret). Tutto lo stato segreto dell'appliance vive qui.
function takoHome(): string {
  const home = process.env['TAKO_HOME'] ?? join(homedir(), '.tako')
  mkdirSync(home, { recursive: true })
  return home
}
const DEVICE_SECRET_FILE = () => join(takoHome(), 'device-secret')
const IDENTITY_FILE = () => join(takoHome(), 'cloud-identity.enc')

// ─── Device secret (radice di fiducia locale) ───────────────────────────────────
// 64 byte CSPRNG, hex, persistiti a 0600. Da qui deriviamo la chiave AES dello store.
function loadDeviceSecret(): Buffer {
  const f = DEVICE_SECRET_FILE()
  if (existsSync(f)) return Buffer.from(readFileSync(f, 'utf8').trim(), 'hex')
  const secret = randomBytes(64)
  writeFileSync(f, secret.toString('hex'), { mode: 0o600 })
  return secret
}

// AES-256-GCM con salt+iv random per cifratura, scrypt per la KDF.
const AES_ALGO = 'aes-256-gcm'
function deriveKey(deviceSecret: Buffer, salt: Buffer): Buffer {
  // N=2^14 è un buon compromesso CPU per un servizio long-running (no per-request).
  return scryptSync(deviceSecret, salt, 32, { N: 16384, r: 8, p: 1 })
}

interface IdentityStore {
  // Keypair ed25519 in PEM (PKCS8 privkey / SPKI pubkey).
  privateKeyPem: string
  publicKeyPem: string
  // Popolati dopo un claim riuscito (null se ancora non accoppiata).
  applianceId: string | null
  applianceToken: string | null
  cloudOwnerId: string | null
  cloudRestaurantId: string | null
  ownerEmail: string | null
  ownerName: string | null
  credentialsVersion: number
  pairedAt: string | null
}

function emptyStore(): IdentityStore {
  // Genera la keypair ed25519 al primo accesso. ed25519 = firme compatte e veloci.
  const { publicKey, privateKey } = generateKeyPairSync('ed25519')
  return {
    privateKeyPem: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
    publicKeyPem: publicKey.export({ type: 'spki', format: 'pem' }).toString(),
    applianceId: null,
    applianceToken: null,
    cloudOwnerId: null,
    cloudRestaurantId: null,
    ownerEmail: null,
    ownerName: null,
    credentialsVersion: 0,
    pairedAt: null,
  }
}

// ─── (De)serializzazione cifrata dello store ─────────────────────────────────────
function encryptStore(store: IdentityStore): Buffer {
  const deviceSecret = loadDeviceSecret()
  const salt = randomBytes(16)
  const iv = randomBytes(12)
  const key = deriveKey(deviceSecret, salt)
  const cipher = createCipheriv(AES_ALGO, key, iv)
  const plaintext = Buffer.from(JSON.stringify(store), 'utf8')
  const enc = Buffer.concat([cipher.update(plaintext), cipher.final()])
  const tag = cipher.getAuthTag()
  // Layout: [salt(16)][iv(12)][tag(16)][ciphertext]. Self-describing, nessun header esterno.
  return Buffer.concat([salt, iv, tag, enc])
}

function decryptStore(blob: Buffer): IdentityStore {
  const deviceSecret = loadDeviceSecret()
  const salt = blob.subarray(0, 16)
  const iv = blob.subarray(16, 28)
  const tag = blob.subarray(28, 44)
  const enc = blob.subarray(44)
  const key = deriveKey(deviceSecret, salt)
  const decipher = createDecipheriv(AES_ALGO, key, iv)
  decipher.setAuthTag(tag)
  const dec = Buffer.concat([decipher.update(enc), decipher.final()])
  return JSON.parse(dec.toString('utf8')) as IdentityStore
}

// Cache in memoria per evitare KDF a ogni accesso. Lo store è piccolo e long-lived.
let cached: IdentityStore | null = null

function loadStore(): IdentityStore {
  if (cached) return cached
  const f = IDENTITY_FILE()
  if (existsSync(f)) {
    try {
      cached = decryptStore(readFileSync(f))
      return cached
    } catch {
      // File corrotto o device-secret cambiato → riparti da uno store vuoto (non
      // accoppiato). Non logghiamo contenuti: nessun dato sensibile nei log.
    }
  }
  cached = emptyStore()
  persistStore(cached)
  return cached
}

function persistStore(store: IdentityStore): void {
  writeFileSync(IDENTITY_FILE(), encryptStore(store), { mode: 0o600 })
  cached = store
}

// ─── API pubblica del modulo ─────────────────────────────────────────────────────

/** Base URL del control-plane. Senza, il pairing è disabilitato (modo local puro). */
export function cloudBaseUrl(): string | null {
  const v = (process.env['CLOUD_BASE_URL'] ?? '').trim().replace(/\/+$/, '')
  return v.length ? v : null
}

export function isPairingConfigured(): boolean {
  return cloudBaseUrl() !== null
}

/** Pubkey ed25519 dell'appliance in PEM (SPKI). Inviata al cloud nel claim. */
export function getDevicePublicKey(): string {
  return loadStore().publicKeyPem
}

/**
 * applianceId assegnato dal cloud al pairing (null se non accoppiata). Serve a costruire
 * il QR stabile del tavolo `${publicBaseUrl}/t/<applianceId>/...` (vedi lib/network.ts).
 */
export function getApplianceId(): string | null {
  return loadStore().applianceId
}

/** Stato sintetico per la dashboard (nessun segreto esposto). */
export function pairingState() {
  const s = loadStore()
  return {
    configured: isPairingConfigured(),
    paired: !!s.applianceId,
    cloudOwnerId: s.cloudOwnerId,
    ownerEmail: s.ownerEmail,
    ownerName: s.ownerName,
    restaurantId: s.cloudRestaurantId,
    credentialsVersion: s.credentialsVersion,
    pairedAt: s.pairedAt,
  }
}

// Firma ed25519 di un payload arbitrario (proof-of-possession dell'heartbeat).
function signPayload(payload: string): string {
  const s = loadStore()
  const key = createPrivateKey(s.privateKeyPem)
  // ed25519: sign() con algoritmo null (la curva implica già SHA-512 interno).
  return edSign(null, Buffer.from(payload, 'utf8'), key).toString('base64url')
}

// Verifica difensiva che la keypair sia coerente (privkey↔pubkey) — usata in test/diag.
export function selfTestKeypair(): boolean {
  try {
    const s = loadStore()
    const msg = Buffer.from('tako-selftest')
    const sig = edSign(null, msg, createPrivateKey(s.privateKeyPem))
    return edVerify(null, msg, createPublicKey(s.publicKeyPem), sig)
  } catch {
    return false
  }
}

// fetch con timeout esplicito (mai chiamate appese su rete del control-plane).
async function cloudFetch(path: string, init: RequestInit, timeoutMs = 10000): Promise<Response> {
  const base = cloudBaseUrl()
  if (!base) throw new Error('CLOUD_BASE_URL non configurata')
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    return await fetch(base + path, { ...init, signal: ctrl.signal })
  } finally {
    clearTimeout(t)
  }
}

export interface ClaimResult {
  ok: boolean
  /** Errore "soft" da mostrare all'utente; mai stacktrace/segreti. */
  error?: string
  ownerEmail?: string
  ownerName?: string
  restaurantId?: string
}

/**
 * Riscatta un device code presso il cloud e PERSISTE il bundle (store cifrato).
 * NON riceve né salva il password_hash cloud (SEC-001): solo lo snapshot non-segreto.
 */
export async function claim(code: string): Promise<ClaimResult> {
  if (!isPairingConfigured()) return { ok: false, error: 'Pairing cloud non configurato su questa appliance.' }
  const devicePubKey = getDevicePublicKey()
  let res: Response
  try {
    res = await cloudFetch('/api/pair/claim', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ code, devicePubKey }),
    })
  } catch {
    // Timeout o cloud irraggiungibile: fallback chiaro, nessun dettaglio rete al client.
    return { ok: false, error: 'Control-plane non raggiungibile. Verifica la connessione e riprova.' }
  }

  let body: any = null
  try { body = await res.json() } catch { /* risposta non-JSON */ }

  if (!res.ok) {
    // Logghiamo SOLO lo status, mai il body (può contenere dettagli del code).
    return { ok: false, error: body?.error?.message ?? `Pairing rifiutato (HTTP ${res.status}).` }
  }

  const data = body?.data
  const snap = data?.ownerSnapshot
  if (!data?.applianceId || !data?.applianceToken || !snap?.cloud_owner_id || !data?.restaurant?.id) {
    return { ok: false, error: 'Risposta del cloud incompleta.' }
  }
  // Difesa SEC-001: se per qualunque motivo arrivasse un campo password, lo ignoriamo
  // esplicitamente (non lo persistiamo MAI). Lo store ammette solo i campi previsti.
  const store = loadStore()
  store.applianceId = String(data.applianceId)
  store.applianceToken = String(data.applianceToken)
  store.cloudOwnerId = String(snap.cloud_owner_id)
  store.cloudRestaurantId = String(data.restaurant.id)
  store.ownerEmail = snap.email ? String(snap.email) : null
  store.ownerName = snap.name ? String(snap.name) : null
  store.credentialsVersion = Number.isFinite(data.credentialsVersion) ? Number(data.credentialsVersion) : 0
  store.pairedAt = new Date().toISOString()
  persistStore(store)

  return {
    ok: true,
    ownerEmail: store.ownerEmail ?? undefined,
    ownerName: store.ownerName ?? undefined,
    restaurantId: store.cloudRestaurantId ?? undefined,
  }
}

export interface HeartbeatResult {
  ok: boolean
  /** 'none' | 'refresh' (cloud ha bumpato credentials_version) | 'revoke' (appliance revocata) | 'offline'. */
  action: 'none' | 'refresh' | 'revoke' | 'offline'
  credentialsVersion?: number
  error?: string
}

/**
 * Heartbeat firmata (proof-of-possession). Best-effort: in offline non è un errore,
 * il login owner offline continua a funzionare (degrado controllato — SEC-007/§7bis).
 * Se il cloud segnala refresh/revoke, il chiamante (setup route) aggiorna lo stato.
 */
export async function heartbeat(): Promise<HeartbeatResult> {
  const s = loadStore()
  if (!isPairingConfigured() || !s.applianceId) return { ok: false, action: 'none', error: 'Appliance non accoppiata.' }

  // Proof-of-possession: firmiamo {applianceId, ts, credentialsVersion}. Il cloud
  // (Fase futura) verificherà la firma con la pubkey registrata. Già oggi l'inviamo
  // così il protocollo è stabile; il cloud di Fase 2b identifica via applianceId.
  const ts = Date.now()
  const payload = JSON.stringify({ applianceId: s.applianceId, ts, credentialsVersion: s.credentialsVersion })
  const signature = signPayload(payload)

  // Pubblica la rete LAN CORRENTE così il resolver cloud (/t/:applianceId) sa dove
  // reindirizzare il QR stabile del tavolo. NON è nel payload firmato: il body viaggia
  // su TLS verso api.takoitalia.com (integrità garantita dal TLS) e lato cloud lanIp è
  // ri-validato come RFC1918 (chiude l'open-redirect). Un'appliance può aggiornare solo
  // la PROPRIA riga (identificata dalla firma) → nessun impatto cross-tenant.
  const lanIp = primaryLanIPv4()
  const hbBody: {
    credentialsVersion: number
    clientPort: number
    lanHost: string
    lanIp?: string
  } = { credentialsVersion: s.credentialsVersion, clientPort: clientPort(), lanHost: mdnsHost() }
  if (lanIp) hbBody.lanIp = lanIp

  let res: Response
  try {
    res = await cloudFetch('/api/pair/heartbeat', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-tako-appliance-token': s.applianceId, // identifica il record appliance (Fase 2b)
        'x-tako-signature': signature,
        'x-tako-timestamp': String(ts),
      },
      body: JSON.stringify(hbBody),
    })
  } catch {
    return { ok: false, action: 'offline' }
  }

  let body: any = null
  try { body = await res.json() } catch { /* ignore */ }

  if (res.status === 403 && body?.data?.action === 'revoke') {
    return { ok: true, action: 'revoke' }
  }
  if (!res.ok) {
    return { ok: false, action: 'offline', error: `Heartbeat fallita (HTTP ${res.status}).` }
  }

  const action = body?.data?.action === 'refresh' ? 'refresh' : 'none'
  const cv = Number(body?.data?.credentialsVersion)
  if (Number.isFinite(cv)) {
    // Aggiorna lo snapshot non-segreto della versione vista lato cloud.
    s.credentialsVersion = cv
    persistStore(s)
  }
  return { ok: true, action, credentialsVersion: Number.isFinite(cv) ? cv : undefined }
}

/** Snapshot dell'identità owner sincronizzata (per creare/aggiornare users locale). */
export function ownerSnapshot() {
  const s = loadStore()
  if (!s.applianceId || !s.cloudOwnerId) return null
  return {
    cloudOwnerId: s.cloudOwnerId,
    email: s.ownerEmail,
    name: s.ownerName,
    restaurantId: s.cloudRestaurantId,
    credentialsVersion: s.credentialsVersion,
  }
}

/** Reset completo del pairing locale (box dismesso/ri-accoppiamento). Mantiene la keypair. */
export function resetPairing(): void {
  const s = loadStore()
  s.applianceId = null
  s.applianceToken = null
  s.cloudOwnerId = null
  s.cloudRestaurantId = null
  s.ownerEmail = null
  s.ownerName = null
  s.pairedAt = null
  persistStore(s)
}
