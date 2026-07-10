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
// Generazione via `openssl` (presente su macOS/Linux): nessuna dipendenza npm nuova.
// In node_modules non ci sono `selfsigned`/`node-forge`, quindi openssl è la via pulita.
import { join } from 'node:path'
import { homedir } from 'node:os'
import { existsSync, mkdirSync, readFileSync, writeFileSync, chmodSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { getLanIPv4s } from './network.js'

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

  if (!opensslAvailable()) {
    // Fallback documentato: senza openssl non possiamo generare il cert. Riusa un cert
    // esistente se c'è (anche se i SAN non combaciano più), altrimenti fallisce con un
    // messaggio chiaro invece di avviare un https rotto.
    if (existsSync(keyPath) && existsSync(certPath)) {
      return { key: readFileSync(keyPath), cert: readFileSync(certPath) }
    }
    throw new Error(
      "TAKO_HTTPS=1 richiede un certificato TLS ma 'openssl' non è disponibile e non ne esiste uno " +
        `in ${dir}. Installa openssl, oppure fornisci key.pem/cert.pem in quella cartella, ` +
        'oppure disattiva HTTPS (togli TAKO_HTTPS).',
    )
  }

  mkdirSync(dir, { recursive: true })
  try {
    chmodSync(dir, 0o700)
  } catch {
    /* best-effort su filesystem che non supportano i permessi POSIX */
  }

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
