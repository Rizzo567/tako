// Route CONTATTI del sito (control-plane cloud).
// Form pubblico "scrivici" / "richiedi demo" della landing: NON crea account,
// NON chiede password. Inoltra il messaggio via email al titolare di Tako
// (ADMIN_NOTIFY_EMAIL, default Manuel). Rate-limited come gli endpoint auth
// (classe SENSITIVE_AUTH in server.ts) perché spedisce email.
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { sendEmail } from '../../cloud/email.js'
import { audit } from '../../cloud/audit.js'

const contactSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(254),
  restaurant: z.string().trim().max(160).optional().default(''),
  phone: z.string().trim().max(40).optional().default(''),
  message: z.string().trim().min(1).max(4000),
  intent: z.enum(['info', 'demo']).optional().default('info'),
})

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string))
}

export async function cloudContactRoutes(fastify: FastifyInstance) {
  fastify.post('/contact', async (req, reply) => {
    const parsed = contactSchema.safeParse(req.body)
    if (!parsed.success) {
      return reply.code(400).send({ error: { code: 'VALIDATION', message: 'Compila nome, email e messaggio.' } })
    }
    const { name, email, restaurant, phone, message, intent } = parsed.data
    const admin = process.env['ADMIN_NOTIFY_EMAIL']
    if (!admin) {
      // Nessun fallback hardcoded: se manca la env, logga e non inviare, ma non
      // bloccare l'utente (risposta 200 come nel caso di invio riuscito).
      req.log.warn('[cloud/contact] ADMIN_NOTIFY_EMAIL non configurata: notifica contatto saltata.')
      await audit({ event: 'contact', req, meta: { intent, skipped: 'no_admin_email' } }).catch(() => {})
      return reply.code(200).send({ data: { message: 'Messaggio inviato. Ti rispondiamo via email entro un giorno lavorativo.' } })
    }
    const subject = intent === 'demo'
      ? `Richiesta demo Tako: ${name}`
      : `Nuovo messaggio dal sito Tako: ${name}`
    const html = `
      <div style="font-family:system-ui,sans-serif;font-size:15px;color:#2A1F1A">
        <h2>${intent === 'demo' ? '📅 Richiesta demo' : '✉️ Nuovo messaggio dal sito'}</h2>
        <p><b>Nome:</b> ${esc(name)}</p>
        <p><b>Email:</b> <a href="mailto:${esc(email)}">${esc(email)}</a></p>
        ${restaurant ? `<p><b>Ristorante:</b> ${esc(restaurant)}</p>` : ''}
        ${phone ? `<p><b>Telefono:</b> ${esc(phone)}</p>` : ''}
        <p><b>Messaggio:</b></p>
        <p style="white-space:pre-wrap;border-left:3px solid #ED7159;padding-left:12px">${esc(message)}</p>
      </div>`

    // Best-effort: se l'email fallisce, non bloccare l'utente con un 500.
    await sendEmail({ to: admin, subject, html }).catch((err) => req.log.error({ err }, 'contact email failed'))
    await audit({ event: 'contact', req, meta: { intent } }).catch(() => {})

    return reply.code(200).send({ data: { message: 'Messaggio inviato. Ti rispondiamo via email entro un giorno lavorativo.' } })
  })
}
