// mDNS best-effort: annuncia "tako.local" sulla LAN così i dispositivi aprono
// http://tako.local:PORT senza digitare un IP. Non fatale: se la porta mDNS è
// occupata dal responder di sistema (es. macOS) o non disponibile, si degrada
// silenziosamente all'IP (vedi /api/system/info). Disattiva con MDNS=0.
import makeMdns from 'multicast-dns'
import { getLanIPv4s } from './network.js'

let instance: ReturnType<typeof makeMdns> | null = null

export function startMdns(label = 'tako'): void {
  if (process.env['MDNS'] === '0' || instance) return
  const host = `${label}.local`
  try {
    const mdns = makeMdns()
    instance = mdns
    mdns.on('query', (query) => {
      const wantsUs = query.questions?.some(
        (q) => (q.type === 'A' || q.type === 'ANY') && q.name?.toLowerCase() === host,
      )
      if (!wantsUs) return
      const ips = getLanIPv4s()
      if (!ips.length) return
      mdns.respond({ answers: ips.map((ip) => ({ name: host, type: 'A', ttl: 120, data: ip })) })
    })
    mdns.on('error', () => { /* best-effort */ })
    console.log(`[mdns] annuncio ${host} → ${getLanIPv4s().join(', ') || '(nessun IP LAN)'}`)
  } catch (e) {
    console.warn('[mdns] non disponibile:', (e as Error).message)
  }
}

export function stopMdns(): void {
  try { instance?.destroy() } catch { /* best-effort */ }
  instance = null
}
