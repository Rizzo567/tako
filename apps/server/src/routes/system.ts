// Info di sistema per la schermata "collega dispositivi": URL a cui i tablet/
// telefoni si agganciano (IP LAN + tako.local) e un QR pronto da mostrare/stampare.
import type { FastifyPluginAsync } from 'fastify'
import { isWebMode, webOrigin } from '../lib/web-runtime.js'
import QRCode from 'qrcode'
import { getLanIPv4s, primaryLanIPv4, clientBaseUrl, lanBaseUrl, remoteBaseUrl } from '../lib/network.js'
import { getConnectivity } from '../lib/connectivity.js'
import { getNetworkHealth } from '../lib/net-health.js'
import { getTunnelStatus } from '../lib/tunnel.js'

export const systemRoutes: FastifyPluginAsync = async (fastify) => {
  // Stato connettività INTERNET (il core non ne dipende): per il badge offline di dashboard/PWA.
  fastify.get('/connectivity', async () => ({ data: getConnectivity() }))

  // Diagnosi qualità rete LAN/WiFi (Fase 3): avvisa se la rete è instabile → self-service a rischio.
  fastify.get('/net-health', async () => ({ data: isWebMode() ? { status: 'online', message: 'Servizio web: la connessione del dispositivo è verificata dal browser.' } : await getNetworkHealth() }))

  fastify.get('/info', async () => {
    if (isWebMode()) {
      const origin = webOrigin()
      const dashboard = `${origin}/staff/index.html`
      return { data: { mode: 'web', onlineOnly: true, registrationEnabled: process.env['TAKO_DISABLE_REGISTRATION'] !== '1', clientBaseUrl: origin,
        lanIPs: [], lanIP: null, lanUrl: null, remoteUrl: origin,
        urls: { primary: origin, dashboard, client: origin, lan: null, mdns: null, remote: origin },
        qrDataUrl: await QRCode.toDataURL(dashboard, { margin: 1, width: 220 }),
        tunnel: { state: 'disabled' } } }
    }
    const port = Number(process.env['PORT'] ?? 4317)
    const ips = getLanIPv4s()
    const lanIP = primaryLanIPv4()
    const primary = lanIP ? `http://${lanIP}:${port}` : `http://localhost:${port}`
    const dashboard = `${primary}/staff/index.html`
    const clientBase = clientBaseUrl()
    const qrDataUrl = await QRCode.toDataURL(dashboard, { margin: 1, width: 220 })
    // Envelope { data } come le altre route (TakoAPI scarta il wrapper).
    return {
      data: {
        port,
        lanIPs: ips,
        lanIP,
        clientBaseUrl: clientBase,
        // Dual-endpoint LAN-first dell'app owner: `lanUrl` è il primo tentativo (mDNS,
        // ~5ms, funziona senza internet), `remoteUrl` il ripiego via tunnel (HTTPS
        // valido). remoteUrl è null quando il tunnel non è configurato → app LAN-only.
        lanUrl: lanBaseUrl(),
        remoteUrl: remoteBaseUrl(),
        urls: {
          primary,
          dashboard,
          client: clientBase,
          mdns: `http://tako.local:${port}`,
          lan: lanBaseUrl(),
          remote: remoteBaseUrl(),
        },
        qrDataUrl,
        // Stato del Cloudflare Tunnel (accesso remoto dell'app owner). Mai il token:
        // solo state + hostname pubblico. 'disabled' = appliance LAN-only.
        tunnel: getTunnelStatus(),
      },
    }
  })
}
