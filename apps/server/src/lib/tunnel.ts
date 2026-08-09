// ─────────────────────────── Tako — SUPERVISIONE CLOUDFLARE TUNNEL ───────────────────────────
// L'appliance è dietro NAT/CGNAT: nessuna porta in ingresso, nessun port-forwarding sul router
// del cliente. `cloudflared` apre una connessione IN USCITA verso Cloudflare, che pubblica
// l'appliance su un hostname HTTPS valido. È lo stesso pattern outbound-only già dimostrato in
// casa da Baileys (lib/whatsapp.ts) e dal comando "deploy mobile".
//
// REGOLE DI CONVIVENZA (identiche a lib/whatsapp.ts):
//   • Il tunnel è un EXTRA, non il core. Qualunque cosa esploda qui (binario assente, token
//     invalido, processo che muore) NON deve MAI tirare giù il server: la LAN continua a essere
//     servita. Ogni funzione esportata è best-effort e non lancia mai.
//   • È DISABILITATO di default: parte solo con TAKO_TUNNEL_TOKEN (tunnel nominato, in
//     produzione) oppure TAKO_TUNNEL_QUICK=1 (quick tunnel effimero, per collaudo).
//   • Il token è un SEGRETO: non finisce mai nei log né nello stato esposto dall'API.
//
// STATO ESPOSTO (GET /api/system/info → data.tunnel):
//   { state: 'disabled' | 'down' | 'up', hostname: string | null }
//   - 'disabled' → nessun token/quick configurato: l'app owner resta LAN-only (degrado pulito).
//   - 'down'     → configurato ma non connesso (in avvio, in errore, o processo appena morto).
//   - 'up'       → cloudflared ha registrato almeno una connessione verso il bordo Cloudflare.
//
// SUPERVISIONE: se il processo figlio esce, lo stato torna subito 'down' e il riavvio è
// schedulato con backoff esponenziale (5s → 60s max). Nessun retry cieco: il backoff cresce
// finché il tunnel non torna su, e si azzera alla prima connessione registrata.

import { spawn, type ChildProcess } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'
import { homedir, platform } from 'node:os'
import { fileURLToPath } from 'node:url'
import { delimiter } from 'node:path'

export type TunnelState = 'disabled' | 'down' | 'up'

export interface TunnelStatus {
  state: TunnelState
  /** Hostname pubblico (senza schema). null finché non è noto. MAI il token. */
  hostname: string | null
}

// ─────────────────────────── Configurazione ───────────────────────────

function tunnelToken(): string | null {
  const v = (process.env['TAKO_TUNNEL_TOKEN'] ?? '').trim()
  return v.length ? v : null
}

/** Quick tunnel (nessun token, hostname effimero *.trycloudflare.com): solo collaudo. */
function quickMode(): boolean {
  return process.env['TAKO_TUNNEL_QUICK'] === '1'
}

/** Il tunnel è configurato? Senza token e senza quick-mode resta 'disabled'. */
export function isTunnelConfigured(): boolean {
  return tunnelToken() !== null || quickMode()
}

/**
 * Hostname pubblico dichiarato dall'amministratore. Per un tunnel NOMINATO il routing
 * vive nella dashboard Cloudflare e il binario non ce lo comunica: va dichiarato qui.
 * Per un quick tunnel viene invece scoperto dall'output del processo.
 */
function configuredHostname(): string | null {
  const v = (process.env['TAKO_TUNNEL_HOSTNAME'] ?? '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/+$/, '')
  return v.length ? v : null
}

// ─────────────────────────── Risoluzione del binario ───────────────────────────
// Cascata, primo che esiste vince (stesso schema di STAFF_DIR/OWNER_DIR in index.ts):
//   1. TAKO_CLOUDFLARED_PATH — override esplicito;
//   2. risorsa impacchettata accanto al bundle server (app desktop Tauri);
//   3. ~/.local/bin/cloudflared — dove sta oggi sul Mac di sviluppo;
//   4. PATH di sistema.
function cloudflaredCandidates(): string[] {
  const currentDir = dirname(fileURLToPath(import.meta.url))
  const exe = platform() === 'win32' ? 'cloudflared.exe' : 'cloudflared'
  const out: string[] = []
  const env = (process.env['TAKO_CLOUDFLARED_PATH'] ?? '').trim()
  if (env) out.push(resolve(env))
  // Bundle desktop: resources/server/cloudflared (o resources/cloudflared).
  out.push(resolve(currentDir, exe))
  out.push(resolve(currentDir, '..', exe))
  out.push(join(homedir(), '.local', 'bin', exe))
  for (const dir of (process.env['PATH'] ?? '').split(delimiter)) {
    if (dir.trim()) out.push(join(dir.trim(), exe))
  }
  return out
}

/** Percorso del binario cloudflared, o null se non installato. Non lancia mai. */
export function resolveCloudflaredPath(): string | null {
  try {
    return cloudflaredCandidates().find((p) => existsSync(p)) ?? null
  } catch {
    return null
  }
}

// ─────────────────────────── Stato in memoria ───────────────────────────

let child: ChildProcess | null = null
let connected = false
let discoveredHostname: string | null = null
let stopping = false
let restartTimer: ReturnType<typeof setTimeout> | null = null
let restartAttempt = 0

const RESTART_BASE_MS = 5_000
const RESTART_MAX_MS = 60_000

/** Stato pubblico del tunnel. Non contiene mai il token. */
export function getTunnelStatus(): TunnelStatus {
  if (!isTunnelConfigured()) return { state: 'disabled', hostname: configuredHostname() }
  return { state: connected ? 'up' : 'down', hostname: tunnelHostname() }
}

/**
 * Hostname pubblico corrente: quello dichiarato ha la precedenza (tunnel nominato),
 * altrimenti quello scoperto dall'output di un quick tunnel. null se sconosciuto.
 */
export function tunnelHostname(): string | null {
  return configuredHostname() ?? discoveredHostname
}

// ─────────────────────────── Lettura dell'output di cloudflared ───────────────────────────
// Marcatori di connessione registrata. Il formato dei log di cloudflared è cambiato più volte
// fra le versioni: teniamo il match LARGO (più alternative) invece di legarci a una stringa
// esatta, così un aggiornamento del binario non ci lascia bloccati su 'down' per sempre.
const CONNECTED_RE = /registered tunnel connection|connection [0-9a-f-]+ registered|registered connection|tunnel connection curve/i
const DISCONNECTED_RE = /unregistered tunnel connection|lost connection to the edge|failed to serve tunnel connection|no more connections active/i
const QUICK_HOST_RE = /https:\/\/([a-z0-9][a-z0-9-]*\.trycloudflare\.com)/i

function handleLine(line: string): void {
  const text = line.trim()
  if (!text) return
  const quick = QUICK_HOST_RE.exec(text)
  if (quick?.[1]) {
    discoveredHostname = quick[1].toLowerCase()
    console.log(`[tunnel] hostname pubblico: ${discoveredHostname}`)
  }
  if (CONNECTED_RE.test(text)) {
    if (!connected) console.log('[tunnel] connessione registrata → state=up')
    connected = true
    restartAttempt = 0 // il tunnel è salito: azzera il backoff
  } else if (DISCONNECTED_RE.test(text)) {
    connected = false
  }
}

// ─────────────────────────── Avvio / arresto ───────────────────────────

function scheduleRestart(): void {
  if (stopping || restartTimer) return
  const delay = Math.min(RESTART_BASE_MS * 2 ** restartAttempt, RESTART_MAX_MS)
  restartAttempt = Math.min(restartAttempt + 1, 10)
  console.warn(`[tunnel] riavvio fra ${Math.round(delay / 1000)}s`)
  restartTimer = setTimeout(() => {
    restartTimer = null
    void startTunnel()
  }, delay)
  // Un timer di supervisione non deve tenere vivo il processo Node da solo.
  restartTimer.unref?.()
}

/**
 * Avvia (o riavvia) cloudflared. BEST-EFFORT: qualunque errore viene loggato e ingoiato,
 * il server resta vivo e la LAN continua a funzionare. No-op se il tunnel non è configurato
 * o se un processo figlio è già in volo.
 */
export async function startTunnel(): Promise<void> {
  try {
    if (!isTunnelConfigured()) {
      console.log('[tunnel] disabilitato (nessun TAKO_TUNNEL_TOKEN)')
      return
    }
    if (child) return
    stopping = false

    const bin = resolveCloudflaredPath()
    if (!bin) {
      console.warn('[tunnel] binario cloudflared non trovato (TAKO_CLOUDFLARED_PATH, risorse del bundle, ~/.local/bin, PATH) → tunnel non avviato')
      scheduleRestart()
      return
    }

    const token = tunnelToken()
    const port = Number(process.env['PORT'] ?? 3001)
    // --no-autoupdate: il binario è impacchettato con l'app, non deve auto-aggiornarsi
    // sotto i piedi dell'appliance. Il token NON viene mai loggato.
    const args = token
      ? ['tunnel', '--no-autoupdate', 'run', '--token', token]
      : ['tunnel', '--no-autoupdate', '--url', `http://127.0.0.1:${port}`]

    console.log(`[tunnel] avvio ${bin} (${token ? 'tunnel nominato' : 'quick tunnel'})`)
    const proc = spawn(bin, args, { stdio: ['ignore', 'pipe', 'pipe'] })
    child = proc
    connected = false

    const onChunk = (buf: Buffer) => {
      for (const line of buf.toString('utf8').split('\n')) handleLine(line)
    }
    proc.stdout?.on('data', onChunk)
    proc.stderr?.on('data', onChunk) // cloudflared logga su stderr

    proc.on('error', (err) => {
      console.error('[tunnel] errore di processo:', (err as Error)?.message ?? err)
      connected = false
      if (child === proc) child = null
      scheduleRestart()
    })

    proc.on('exit', (code, signal) => {
      // Il processo è morto (crash, kill manuale, rete): stato SUBITO 'down', poi riavvio
      // con backoff. Il server non se ne accorge nemmeno.
      console.warn(`[tunnel] cloudflared uscito (code=${code ?? 'null'} signal=${signal ?? 'null'}) → state=down`)
      connected = false
      if (child === proc) child = null
      scheduleRestart()
    })
  } catch (err) {
    // Rete di sicurezza finale: un tunnel rotto non deve MAI propagare un'eccezione al
    // chiamante (index.ts lo avvia accanto a startMdns()).
    console.error('[tunnel] avvio fallito:', (err as Error)?.message ?? err)
    connected = false
    child = null
  }
}

/** Ferma cloudflared e annulla i riavvii schedulati. Best-effort, non lancia mai. */
export async function stopTunnel(): Promise<void> {
  stopping = true
  if (restartTimer) { clearTimeout(restartTimer); restartTimer = null }
  const proc = child
  child = null
  connected = false
  if (!proc) return
  try {
    proc.kill('SIGTERM')
    // Se non esce entro 3s, insisti. (Su Windows kill() mappa su TerminateProcess: il
    // process-group kill "duro" resta un task separato, cfr. le note su src-tauri.)
    await new Promise<void>((res) => {
      const t = setTimeout(() => { try { proc.kill('SIGKILL') } catch { /* già morto */ } res() }, 3000)
      t.unref?.()
      proc.once('exit', () => { clearTimeout(t); res() })
    })
  } catch (err) {
    console.error('[tunnel] stop fallito:', (err as Error)?.message ?? err)
  }
}
