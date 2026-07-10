// ─────────────────────────── Tako — ROUTE WHATSAPP (owner) ───────────────────────────
// Controllo del canale WhatsApp dalla dashboard: stato + QR di collegamento, on/off, whitelist.
// Tutte le route sono OWNER-ONLY (req.user.role === 'owner'): è un canale con privilegi pieni sul
// ristorante, quindi solo il titolare lo gestisce. Il motore vive in lib/whatsapp.ts.
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import QRCode from 'qrcode'
import { requireAuth } from '../middleware/auth.js'
import { startWhatsApp, stopWhatsApp, getWhatsAppStatus, setAllowedNumbers } from '../lib/whatsapp.js'

export async function whatsappRoutes(fastify: FastifyInstance) {
  // Gate owner-only comune a tutte le route del canale.
  const ownerOnly = async (req: any, reply: any) => {
    await requireAuth(req, reply)
    if (reply.sent) return
    if (req.user?.role !== 'owner') {
      return reply.code(403).send({ error: { code: 'FORBIDDEN', message: 'Solo il titolare può gestire WhatsApp.' } })
    }
  }

  // Stato del canale + QR (dataURL) se in attesa di scansione.
  fastify.get('/status', { preHandler: ownerOnly }, async (_req, reply) => {
    const status = getWhatsAppStatus()
    let qrDataUrl: string | null = null
    if (status.qr) {
      try { qrDataUrl = await QRCode.toDataURL(status.qr) } catch { qrDataUrl = null }
    }
    return { data: { ...status, qrDataUrl } }
  })

  // Attiva il canale (avvia Baileys). Baileys è import dinamico + try/catch: un guasto
  // qui non deve abbattere il server, quindi lo mappiamo in un errore leggibile.
  fastify.post('/enable', { preHandler: ownerOnly }, async (_req, reply) => {
    try {
      await startWhatsApp()
      return { data: getWhatsAppStatus() }
    } catch (err: any) {
      fastify.log.error(err, 'whatsapp enable error')
      const code = err?.code === 'WA_DEP_MISSING' ? 'WA_DEP_MISSING' : 'WA_ERROR'
      return reply.code(502).send({ error: { code, message: err?.message || 'Attivazione WhatsApp non riuscita.' } })
    }
  })

  // Disattiva il canale.
  fastify.post('/disable', { preHandler: ownerOnly }, async (_req, reply) => {
    try {
      await stopWhatsApp()
      return { data: getWhatsAppStatus() }
    } catch (err: any) {
      fastify.log.error(err, 'whatsapp disable error')
      return reply.code(502).send({ error: { code: 'WA_ERROR', message: 'Disattivazione non riuscita.' } })
    }
  })

  // Aggiorna la whitelist dei numeri autorizzati.
  fastify.post('/numbers', { preHandler: ownerOnly }, async (req, reply) => {
    const schema = z.object({ numbers: z.array(z.string().max(32)).max(20) })
    const parsed = schema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: { code: 'VALIDATION', message: parsed.error.message } })
    const allowed = setAllowedNumbers(parsed.data.numbers)
    return { data: { allowedNumbers: allowed } }
  })
}
