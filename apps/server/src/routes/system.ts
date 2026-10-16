// Info di sistema per la dashboard staff: modo runtime (sempre 'web'), URL pubblici
// e un QR della dashboard per la schermata «Collegamenti».
import type { FastifyPluginAsync } from 'fastify'
import { webOrigin } from '../lib/web-runtime.js'
import { getConnectivity } from '../lib/connectivity.js'

export const systemRoutes: FastifyPluginAsync = async (fastify) => {
  // Stato connettività INTERNET: per il badge offline di dashboard/PWA.
  fastify.get('/connectivity', async () => ({ data: getConnectivity() }))

  // La qualità della rete del dispositivo è verificata dal browser, non dal server.
  fastify.get('/net-health', async () => ({ data: { status: 'online', message: 'Servizio web: la connessione del dispositivo è verificata dal browser.' } }))

  fastify.get('/info', async () => {
    const {default:QRCode}=await import('qrcode');
    const origin = webOrigin()
    const dashboard = `${origin}/staff/index.html`
    return { data: { mode: 'web', onlineOnly: true, registrationEnabled: process.env['TAKO_DISABLE_REGISTRATION'] !== '1', clientBaseUrl: origin,
      lanIPs: [], lanIP: null, lanUrl: null, remoteUrl: origin,
      urls: { primary: origin, dashboard, client: origin, lan: null, mdns: null, remote: origin },
      qrDataUrl: await QRCode.toDataURL(dashboard, { margin: 1, width: 220 }),
      tunnel: { state: 'disabled' } } }
  })
}
