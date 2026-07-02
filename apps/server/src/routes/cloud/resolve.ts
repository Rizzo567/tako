// Resolver PUBBLICO del QR STABILE del tavolo (fix "QR fragili").
//
// PROBLEMA: prima il QR incorporava l'IP LAN del box → moriva al cambio IP del router.
// SOLUZIONE: il QR stampato contiene un URL cloud STABILE
//   https://api.takoitalia.com/t/<applianceId>/r/<restaurantId>/t/<qrToken>
// Questa route mappa applianceId → rete LAN CORRENTE (pubblicata dall'appliance via
// heartbeat) e reindirizza il cliente all'appliance locale. L'URL stampato non contiene
// mai l'IP: quando il router cambia IP, l'heartbeat aggiorna il cloud e il QR resta valido.
//
// SICUREZZA / no-leak cross-tenant:
//  - applianceId è un UUID ad alta entropia (non enumerabile).
//  - Si reindirizza SOLO a un IP RFC1918 (ri-validato qui) o al nome mDNS `*.local` →
//    niente open-redirect (il resolver non può puntare a host pubblici arbitrari).
//  - Nessun dato del ristorante è esposto: solo un redirect verso la LAN del cliente.
//  - Il tail del percorso è vincolato a `r/<id>/t/<token>` (charset ristretto) → niente
//    injection nell'HTML/nel target.
//
// OFFLINE / LAN-first: la pagina fa un redirect immediato (meta-refresh, nessun JS inline
// → compatibile con la CSP del control-plane) all'IP LAN corrente, con link secondario al
// nome mDNS. Se il cloud è irraggiungibile, il locale usa il QR di BACKUP `tako.local`
// (vedi lib/network.ts lanTableUrl) che non passa da qui e funziona offline.
import type { FastifyInstance } from 'fastify'
import { eq } from 'drizzle-orm'
import { cloudDb, cloudAppliances } from '../../cloud/db.js'
import { isPrivateLanIPv4 } from '../../lib/network.js'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
// Tail atteso: esattamente il percorso PWA di un tavolo. Charset ristretto → safe in HTML.
const TAIL_RE = /^r\/[A-Za-z0-9._-]{1,64}\/t\/[A-Za-z0-9._-]{1,64}$/
const LANHOST_RE = /^[a-z0-9-]{1,40}\.local$/i

// CSP dedicata a questa route: come quella del control-plane MA senza
// `upgrade-insecure-requests`, altrimenti il browser forzerebbe il redirect verso
// http://<lanIp> a https:// (la PWA locale è in HTTP) rompendolo. Nessun JS inline.
const RESOLVE_CSP =
  "default-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'; " +
  "img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'none'; object-src 'none'"

function shell(title: string, inner: string, metaRefreshTo?: string): string {
  const refresh = metaRefreshTo ? `<meta http-equiv="refresh" content="0;url=${metaRefreshTo}">` : ''
  return `<!doctype html><html lang="it"><head><meta charset="utf-8">` +
    `<meta name="viewport" content="width=device-width,initial-scale=1">${refresh}` +
    `<title>${title}</title><style>` +
    `body{font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#FFF8F3;color:#2A1F1A;` +
    `margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px}` +
    `.card{max-width:22rem;text-align:center}.card h1{font-size:1.15rem;margin:.2rem 0 .6rem}` +
    `.card p{opacity:.8;line-height:1.5;font-size:.95rem}a.btn{display:inline-block;margin-top:1rem;` +
    `padding:.7rem 1.1rem;border-radius:.7rem;background:#2A1F1A;color:#FFF8F3;text-decoration:none}` +
    `a.alt{display:block;margin-top:.8rem;color:#2A1F1A;opacity:.7;font-size:.85rem}` +
    `</style></head><body><div class="card">${inner}</div></body></html>`
}

function notFoundPage(): string {
  return shell('Tavolo non disponibile', `<h1>Tavolo non disponibile</h1>` +
    `<p>Questo codice non è più attivo. Chiedi allo staff un QR aggiornato.</p>`)
}

function offlinePage(): string {
  return shell('Ristorante non raggiungibile', `<h1>Un attimo…</h1>` +
    `<p>Non riesco a raggiungere il sistema del ristorante. Assicurati di essere connesso al ` +
    `<strong>Wi-Fi del locale</strong> e riprova, oppure chiedi allo staff.</p>`)
}

function redirectPage(primary: string, secondary: string | null): string {
  const alt = secondary ? `<a class="alt" href="${secondary}">Non si apre? Tocca qui</a>` : ''
  return shell('Apertura menu…', `<h1>Ti porto al menu…</h1>` +
    `<p>Se non succede nulla, assicurati di essere sul <strong>Wi-Fi del locale</strong>.</p>` +
    `<a class="btn" href="${primary}">Apri il menu</a>${alt}`, primary)
}

export async function cloudResolveRoutes(fastify: FastifyInstance) {
  // GET /t/:applianceId/*  (il wildcard è il percorso PWA locale: r/<rid>/t/<token>)
  fastify.get('/t/:applianceId/*', async (req, reply) => {
    const { applianceId } = req.params as { applianceId: string }
    const tail = ((req.params as Record<string, string>)['*'] ?? '').trim()

    // CSP per-route (override di quella globale) + no-store: il target è dinamico.
    reply.header('content-security-policy', RESOLVE_CSP)
    reply.header('cache-control', 'no-store')
    reply.type('text/html; charset=utf-8')

    if (!UUID_RE.test(applianceId) || !TAIL_RE.test(tail)) {
      return reply.code(404).send(notFoundPage())
    }

    const [appliance] = await cloudDb
      .select({
        lanIp: cloudAppliances.lanIp,
        clientPort: cloudAppliances.clientPort,
        lanHost: cloudAppliances.lanHost,
        revokedAt: cloudAppliances.revokedAt,
      })
      .from(cloudAppliances)
      .where(eq(cloudAppliances.id, applianceId))
      .limit(1)

    // Sconosciuta o revocata → stessa risposta (nessun oracolo su esistenza/stato).
    if (!appliance || appliance.revokedAt) return reply.code(404).send(notFoundPage())

    const port = appliance.clientPort && appliance.clientPort > 0 && appliance.clientPort < 65536
      ? appliance.clientPort
      : 3002
    const ipOk = !!appliance.lanIp && isPrivateLanIPv4(appliance.lanIp)
    const hostOk = !!appliance.lanHost && LANHOST_RE.test(appliance.lanHost)

    // Target primario = IP LAN corrente (freschissimo, risolve sempre se il telefono è in
    // WiFi). Secondario = nome mDNS (indipendente dall'IP) come fallback tappabile.
    const ipUrl = ipOk ? `http://${appliance.lanIp}:${port}/${tail}` : null
    const hostUrl = hostOk ? `http://${appliance.lanHost!.toLowerCase()}:${port}/${tail}` : null
    const primary = ipUrl ?? hostUrl
    if (!primary) return reply.code(503).send(offlinePage())
    const secondary = primary === ipUrl ? hostUrl : null

    return reply.code(200).send(redirectPage(primary, secondary))
  })
}
