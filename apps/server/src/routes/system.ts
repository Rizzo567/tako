// Info di sistema per la schermata "collega dispositivi": URL a cui i tablet/
// telefoni si agganciano (IP LAN + tako.local) e un QR pronto da mostrare/stampare.
import type { FastifyPluginAsync } from 'fastify'
import QRCode from 'qrcode'
import { getLanIPv4s, primaryLanIPv4, clientBaseUrl } from '../lib/network.js'

export const systemRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/info', async () => {
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
        urls: {
          primary,
          dashboard,
          client: clientBase,
          mdns: `http://tako.local:${port}`,
        },
        qrDataUrl,
      },
    }
  })
}
