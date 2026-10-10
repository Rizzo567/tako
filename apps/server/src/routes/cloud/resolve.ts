// QR dei tavoli stampati quando Tako girava sull'appliance locale:
//   https://api.takoitalia.com/t/<applianceId>/r/<restaurantId>/t/<qrToken>
// L'appliance non esiste più, ma il percorso `r/<restaurantId>/t/<qrToken>` è lo stesso
// della webapp (UUID e token conservati nel trasferimento dati). Qui lo si reindirizza
// alla webapp pubblica, così nessun QR già stampato smette di funzionare.
//
// SICUREZZA: la destinazione è sempre WEB_PUBLIC_URL (da env, mai dalla richiesta) più
// un tail vincolato a charset ristretto → niente open-redirect né injection.
import type { FastifyInstance } from 'fastify'
import { webPublicUrl } from '../../cloud/config.js'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const TAIL_RE = /^r\/[A-Za-z0-9._-]{1,64}\/t\/[A-Za-z0-9._-]{1,64}$/

function page(title: string, text: string): string {
  return `<!doctype html><html lang="it"><head><meta charset="utf-8">` +
    `<meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><style>` +
    `body{font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#FFF8F3;color:#2A1F1A;` +
    `margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px}` +
    `div{max-width:22rem;text-align:center}h1{font-size:1.15rem}p{opacity:.8;line-height:1.5}` +
    `</style></head><body><div><h1>${title}</h1><p>${text}</p></div></body></html>`
}

export async function cloudResolveRoutes(fastify: FastifyInstance) {
  fastify.get('/t/:applianceId/*', async (req, reply) => {
    const { applianceId } = req.params as { applianceId: string }
    const tail = ((req.params as Record<string, string>)['*'] ?? '').trim()
    reply.header('cache-control', 'no-store')

    if (!UUID_RE.test(applianceId) || !TAIL_RE.test(tail)) {
      return reply.code(404).type('text/html; charset=utf-8')
        .send(page('Tavolo non disponibile', 'Questo codice non è più attivo. Chiedi allo staff un QR aggiornato.'))
    }
    const base = webPublicUrl()
    if (!base) {
      return reply.code(503).type('text/html; charset=utf-8')
        .send(page('Menu in aggiornamento', 'Il menu digitale sta passando al nuovo sistema. Chiedi allo staff, torna disponibile a breve.'))
    }
    return reply.redirect(`${base}/${tail}`, 302)
  })
}
