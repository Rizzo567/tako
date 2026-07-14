// TLS locale per l'appliance Tako.
//
// Perché: `getUserMedia` (dettatura vocale dal tablet) e diverse Web API richiedono
// un "secure context" — cioè https:// oppure localhost. Via http://tako.local:PORT il
// browser blocca il microfono. Servendo la dashboard/API/socket.io su https il tablet
// ottiene il secure context sull'intera LAN.
//
// Strategia (la più semplice e robusta per un'appliance locale):
//  - genera UN certificato self-signed al primo avvio, con SAN = tako.local + localhost
//    + gli IP LAN correnti (da lib/network.ts) + 127.0.0.1;
//  - lo persiste in ~/.tako/tls/ (o $TAKO_HOME/tls) e lo RIUSA ai riavvii, così la
//    fiducia accettata una volta sul tablet resta valida;
//  - rigenera solo se manca del tutto, se un SAN desiderato non è coperto (es. è
//    comparso un nuovo IP LAN), o se si forza con TAKO_TLS_REGEN=1.
//
// Generazione: `openssl` (presente su macOS/Linux) è la via preferita. Dove openssl
// manca (tipicamente Windows), fallback PURE-JS con la dipendenza `selfsigned`
// (node-forge, nessun binario) → HTTPS funziona comunque e i tablet mantengono il
// secure context per getUserMedia.
import { join } from 'node:path'
import { homedir } from 'node:os'
import { existsSync, mkdirSync, readFileSync, writeFileSync, chmodSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { generate as generateSelfSigned } from 'selfsigned'
import { getLanIPv4s } from './network.js'

// `selfsigned` non pubblica tipi propri: dichiarazione locale minima (sha256, RSA 2048,
// SAN via extensions.subjectAltName con altNames type 2=DNS, type 7=IP).
declare module 'selfsigned' {
  export function generate(
    attrs?: Array<{ name: string; value: string }>,
    options?: Record<string, unknown>,
  ): { private: string; public: string; cert: string }
}

export interface TlsMaterial {
  key: Buffer
  cert: Buffer
}

/** HTTPS è opt-in: attivo solo con TAKO_HTTPS=1. Default OFF così dev/test (http :3001) non cambiano. */
export function httpsEnabled(): boolean {
  return process.env['TAKO_HTTPS'] === '1'
}

function tlsDir(): string {
  const home = process.env['TAKO_HOME'] ?? join(homedir(), '.tako')
  return join(home, 'tls')
}

/** Nomi/indirizzi che il certificato deve coprire. tako.local è il nome canonico (mDNS). */
function desiredSans(): { dns: string[]; ip: string[] } {
  const dns = ['tako.local', 'localhost']
  const ip = Array.from(
    new Set(['127.0.0.1', ...getLanIPv4s().filter((i) => !i.startsWith('169.254.'))]),
  )
  return { dns, ip }
}

function sanKey(s: { dns: string[]; ip: string[] }): string {
  // Ordinato → confronto stabile indipendente dall'ordine di enumerazione delle interfacce.
  return JSON.stringify({ dns: [...s.dns].sort(), ip: [...s.ip].sort() })
}

function opensslAvailable(): boolean {
  try {
    execFileSync('openssl', ['version'], { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

/**
 * Restituisce key+cert self-signed per l'appliance, generandoli/persistendoli al bisogno.
 * Idempotente: se il cert persistito copre già i SAN desiderati, lo riusa senza rigenerare.
 */
export function ensureTlsMaterial(): TlsMaterial {
  const dir = tlsDir()
  const keyPath = join(dir, 'key.pem')
  const certPath = join(dir, 'cert.pem')
  const metaPath = join(dir, 'meta.json')
  const sans = desiredSans()
  const wantKey = sanKey(sans)
  const forceRegen = process.env['TAKO_TLS_REGEN'] === '1'

  const haveAll = existsSync(keyPath) && existsSync(certPath) && existsSync(metaPath)
  if (haveAll && !forceRegen) {
    try {
      const meta = JSON.parse(readFileSync(metaPath, 'utf8')) as { sanKey?: string }
      if (meta.sanKey === wantKey) {
        return { key: readFileSync(keyPath), cert: readFileSync(certPath) }
      }
    } catch {
      // meta corrotto → rigenera sotto.
    }
  }

  mkdirSync(dir, { recursive: true })
  try {
    chmodSync(dir, 0o700)
  } catch {
    /* best-effort su filesystem che non supportano i permessi POSIX */
  }

  if (opensslAvailable()) {
    // Via preferita: openssl (macOS/Linux). Stessi SAN/CN/O/validità del fallback.
    const sanArg = [
      ...sans.dns.map((d) => `DNS:${d}`),
      ...sans.ip.map((i) => `IP:${i}`),
    ].join(',')

    execFileSync(
      'openssl',
      [
        'req', '-x509',
        '-newkey', 'rsa:2048',
        '-nodes',
        '-keyout', keyPath,
        '-out', certPath,
        '-days', '3650',
        '-subj', '/CN=tako.local/O=Tako Appliance',
        '-addext', `subjectAltName=${sanArg}`,
      ],
      { stdio: 'ignore' },
    )
  } else {
    // Fallback pure-JS (niente binario openssl → tipicamente Windows): `selfsigned`
    // genera key+cert self-signed con gli STESSI SAN (DNS = tako.local/localhost,
    // IP = 127.0.0.1 + IP LAN), CN=tako.local, O=Tako Appliance, RSA 2048, sha256,
    // validità 3650 giorni. altNames: type 2 = DNS, type 7 = IP.
    const altNames = [
      ...sans.dns.map((value) => ({ type: 2, value })),
      ...sans.ip.map((ip) => ({ type: 7, ip })),
    ]
    const pems = generateSelfSigned(
      [
        { name: 'commonName', value: 'tako.local' },
        { name: 'organizationName', value: 'Tako Appliance' },
      ],
      {
        days: 3650,
        keySize: 2048,
        algorithm: 'sha256',
        extensions: [{ name: 'subjectAltName', altNames }],
      },
    )
    writeFileSync(keyPath, pems.private)
    writeFileSync(certPath, pems.cert)
  }

  try {
    chmodSync(keyPath, 0o600)
  } catch {
    /* best-effort */
  }
  writeFileSync(metaPath, JSON.stringify({ sanKey: wantKey, generatedAt: new Date().toISOString() }), {
    mode: 0o600,
  })

  return { key: readFileSync(keyPath), cert: readFileSync(certPath) }
}
