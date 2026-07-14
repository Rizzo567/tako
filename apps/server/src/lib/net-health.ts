// ─────────────────────────── Tako — DIAGNOSI QUALITÀ RETE LAN/WiFi ───────────────────────────
// Misura la stabilità della rete LOCALE (quella che porta i telefoni cliente al Mac): pinga il
// gateway e stima perdita pacchetti, latenza e jitter. Alta perdita/jitter = WiFi instabile →
// il self-service cliente è a rischio (avviso in dashboard). Best-effort, senza sudo, mai lancia.
// Nota: nessun software "aggiusta" un WiFi fisicamente scarso — qui lo si DIAGNOSTICA e si avvisa
// (la soluzione robusta è la rete: vedi docs/setup-rete-ristorante.md, es. Mac come hotspot).
import { exec } from 'node:child_process'

export type NetHealth = {
  status: 'ok' | 'debole' | 'instabile' | 'sconosciuto'
  gateway: string | null
  lossPct: number | null
  avgMs: number | null
  maxMs: number | null
  jitterMs: number | null
  iface: string | null
  ssid: string | null
  message: string
}

function sh(cmd: string, timeoutMs: number): Promise<string> {
  return new Promise((resolve) => {
    exec(cmd, { timeout: timeoutMs, windowsHide: true }, (_err, stdout) => resolve(stdout ?? ''))
  })
}

// Gateway di default + interfaccia (macOS: `route -n get default`; Windows: `route print`).
async function defaultRoute(): Promise<{ gateway: string | null; iface: string | null }> {
  if (process.platform === 'win32') {
    // `route print 0.0.0.0` elenca la default route; la riga è del tipo
    // `0.0.0.0  0.0.0.0  <gateway>  <iface>  <metric>`. L'interfaccia qui è un IP,
    // non un nome device utile → la lasciamo null (basta il gateway per il ping).
    const out = await sh('route print 0.0.0.0', 3000)
    const gw = /^\s*0\.0\.0\.0\s+0\.0\.0\.0\s+([0-9]+\.[0-9]+\.[0-9]+\.[0-9]+)/m.exec(out)?.[1] ?? null
    return { gateway: gw, iface: null }
  }
  const out = await sh('route -n get default 2>/dev/null', 3000)
  const gw = /gateway:\s*([0-9.]+)/.exec(out)?.[1] ?? null
  const iface = /interface:\s*(\S+)/.exec(out)?.[1] ?? null
  return { gateway: gw, iface }
}

// SSID WiFi corrente (best-effort; vuoto se su Ethernet o non leggibile).
async function currentSsid(iface: string | null): Promise<string | null> {
  if (process.platform === 'win32') {
    // `netsh wlan show interfaces`: la label `SSID` NON è localizzata (BSSID non
    // combacia perché `^\s*SSID` non matcha la 'B' iniziale). Niente WLAN → null.
    const out = await sh('netsh wlan show interfaces', 3000)
    const m = /^\s*SSID\s*:\s*(.+)$/m.exec(out)
    return m ? m[1]!.trim() : null
  }
  if (!iface) return null
  const out = await sh(`networksetup -getairportnetwork ${iface} 2>/dev/null`, 3000)
  const m = /Current Wi-Fi Network:\s*(.+)\s*$/m.exec(out)
  return m ? m[1]!.trim() : null
}

// Ping del gateway: N pacchetti, ricava perdita% e rtt avg/max; il jitter ≈ (max-avg).
async function pingGateway(gateway: string): Promise<{ lossPct: number | null; avgMs: number | null; maxMs: number | null }> {
  if (process.platform === 'win32') {
    // ping.exe: -n 5 pacchetti, -w 4000 timeout per pacchetto. L'output è LOCALIZZATO
    // (es. IT: 'Persi = 1 (20% persi)', 'Minimo = 0ms, Massimo = 1ms, Medio = 0ms').
    // Parsing locale-proof: percentuale via `(\d+)%` (vale per '(0% loss)' e '(0% persi)');
    // rtt via tutti i `= <n> ms` — su Windows l'ordine è SEMPRE Minimo, Massimo, Medio,
    // quindi max = 2° match, avg = 3° match.
    const out = await sh(`ping -n 5 -w 4000 ${gateway}`, 7000)
    const loss = /\((\d+)%/.exec(out)?.[1]
    const rtts = [...out.matchAll(/=\s*(\d+)\s*ms/g)].map((m) => Number(m[1]))
    return {
      lossPct: loss != null ? Number(loss) : null,
      maxMs: rtts.length >= 2 ? rtts[1]! : null,
      avgMs: rtts.length >= 3 ? rtts[2]! : null,
    }
  }
  // -c 5 pacchetti, -t 4s deadline totale, -q output riassuntivo.
  const out = await sh(`ping -c 5 -t 4 ${gateway} 2>/dev/null`, 7000)
  const loss = /([\d.]+)%\s*packet loss/.exec(out)?.[1]
  const rtt = /=\s*([\d.]+)\/([\d.]+)\/([\d.]+)/.exec(out) // min/avg/max
  return {
    lossPct: loss != null ? Number(loss) : null,
    avgMs: rtt ? Number(rtt[2]) : null,
    maxMs: rtt ? Number(rtt[3]) : null,
  }
}

/** Classifica lo stato rete e produce un messaggio pronto per la dashboard. */
export async function getNetworkHealth(): Promise<NetHealth> {
  try {
    const { gateway, iface } = await defaultRoute()
    if (!gateway) {
      return { status: 'sconosciuto', gateway: null, lossPct: null, avgMs: null, maxMs: null, jitterMs: null, iface, ssid: null, message: 'Gateway di rete non rilevato.' }
    }
    const [{ lossPct, avgMs, maxMs }, ssid] = await Promise.all([pingGateway(gateway), currentSsid(iface)])
    const jitterMs = avgMs != null && maxMs != null ? Math.round((maxMs - avgMs) * 10) / 10 : null

    let status: NetHealth['status'] = 'ok'
    let message = 'Rete locale stabile.'
    if (lossPct == null && avgMs == null) {
      status = 'sconosciuto'
      message = 'Impossibile misurare la rete locale.'
    } else if ((lossPct ?? 0) >= 20 || (maxMs ?? 0) >= 250 || (jitterMs ?? 0) >= 120) {
      status = 'instabile'
      message = 'Rete locale INSTABILE: il menu al tavolo e il self-service possono cadere. Avvicina l\'access point, usa un SSID dedicato o il Mac come hotspot (vedi guida setup rete).'
    } else if ((lossPct ?? 0) >= 5 || (maxMs ?? 0) >= 120 || (jitterMs ?? 0) >= 50) {
      status = 'debole'
      message = 'Rete locale debole: possibili rallentamenti per i clienti. Verifica copertura WiFi e congestione.'
    }
    return { status, gateway, lossPct, avgMs, maxMs, jitterMs, iface, ssid, message }
  } catch {
    return { status: 'sconosciuto', gateway: null, lossPct: null, avgMs: null, maxMs: null, jitterMs: null, iface: null, ssid: null, message: 'Diagnosi rete non disponibile.' }
  }
}
