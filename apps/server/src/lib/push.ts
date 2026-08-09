// ───────────────────────────── Tako — NOTIFICHE PUSH (Web Push VAPID) ─────────────────────────────
//
// L'appliance è essa stessa l'application server VAPID (piano §3 D5): non c'è nessun
// relay. Ha internet IN USCITA — lo sonda già ogni 30 s (lib/connectivity.ts) — e un
// push service (Apple/Google/Mozilla) si contatta esattamente così: un POST in uscita.
//
// Tre regole che valgono per ogni riga di questo file:
//
//  1. NON LANCIA MAI. Una push è un di più: se il push service è giù, se il telefono
//     ha disinstallato l'app, se internet cade a metà — l'ordine deve comunque essere
//     creato e la risposta HTTP deve essere già partita. Ogni funzione esportata
//     cattura tutto e restituisce un esito, non un'eccezione.
//  2. FAST-FAIL SENZA INTERNET. `isOnline()` è sincrono e sa già la risposta: senza
//     internet non si apre nessuna connessione che resterebbe appesa fino al timeout.
//  3. MAI PRIMA DELLA RISPOSTA. I trigger usano `pushAfterResponse()`, che rimanda il
//     lavoro a `setImmediate`: il percorso critico dell'ordine non paga nulla.
//
// Il ciclo di vita di una subscription è governato dal DATABASE, non da questo codice:
// `push_subscriptions.session_id → sessions.id ON DELETE CASCADE` (migrazione 0018).
// Revocare un telefono ne spegne le notifiche perché la riga sparisce, non perché
// qualcuno si ricorda di cancellarla.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import webpush from 'web-push'
import { db, pushSubscriptions, sessions } from '@tako/db'
import { and, eq, gt, sql } from 'drizzle-orm'
import { isOnline } from './connectivity.js'

// ─── Chiavi VAPID ────────────────────────────────────────────────────────────────
// Generate una volta e persistite in ~/.tako/vapid.json, con lo stesso schema di
// ~/.tako/jwt-secret (scripts/tako.mjs) e ~/.tako/device-secret (lib/cloud-client.ts).
// Il perché della PERSISTENZA: la chiave pubblica è incisa in ogni subscription già
// registrata dai telefoni. Rigenerarla a ogni avvio invaliderebbe in blocco tutte le
// subscription esistenti — le push smetterebbero di arrivare senza nessun errore
// visibile da nessuna parte.
export interface VapidKeys {
  publicKey: string
  privateKey: string
  subject: string
}

function takoHome(): string {
  const home = process.env['TAKO_HOME'] ?? join(homedir(), '.tako')
  mkdirSync(home, { recursive: true })
  return home
}

const VAPID_FILE = () => join(takoHome(), 'vapid.json')

// Il `subject` VAPID deve essere un mailto: o una URL: è il contatto che il push
// service usa se l'application server si comporta male. Override via env per il
// cloud/self-host, default il nostro supporto.
const VAPID_SUBJECT = () => process.env['TAKO_PUSH_SUBJECT']?.trim() || 'mailto:supporto@takoitalia.com'

let cached: VapidKeys | null = null

/** Carica (o genera al primo avvio) le chiavi VAPID. null solo se il disco è illeggibile. */
export function getVapidKeys(): VapidKeys | null {
  if (cached) return cached
  try {
    const f = VAPID_FILE()
    if (existsSync(f)) {
      const parsed = JSON.parse(readFileSync(f, 'utf8')) as Partial<VapidKeys>
      if (parsed.publicKey && parsed.privateKey) {
        cached = { publicKey: parsed.publicKey, privateKey: parsed.privateKey, subject: VAPID_SUBJECT() }
        return cached
      }
    }
    const generated = webpush.generateVAPIDKeys()
    const keys: VapidKeys = { publicKey: generated.publicKey, privateKey: generated.privateKey, subject: VAPID_SUBJECT() }
    // 0600: la chiave privata VAPID firma le richieste al push service a nome
    // dell'appliance. Stesso trattamento del device-secret.
    writeFileSync(f, JSON.stringify({ publicKey: keys.publicKey, privateKey: keys.privateKey }, null, 2), { mode: 0o600 })
    cached = keys
    return cached
  } catch {
    // Disco in sola lettura o home inaccessibile: niente push, ma il server parte.
    return null
  }
}

/** Chiave pubblica da dare al browser per `pushManager.subscribe()`. */
export function getVapidPublicKey(): string | null {
  return getVapidKeys()?.publicKey ?? null
}

// ─── Notifiche ───────────────────────────────────────────────────────────────────

/** I tre eventi del piano (§5 F3.2). Il `kind` decide urgenza, TTL e deep-link. */
export type PushKind = 'order' | 'waiter' | 'inventory' | 'test'

export interface PushNotification {
  title: string
  body: string
  /** Sezione dell'app owner da aprire al tap (deep-link gestito dal service worker). */
  url: string
  /**
   * Collassa le notifiche dello stesso tipo: cinque ordini in due minuti devono
   * lasciare UNA riga in centro notifiche, non cinque. Il `renotify` lato SW fa
   * comunque vibrare il telefono a ogni evento.
   */
  tag: string
  kind: PushKind
}

// TTL = per quanto il push service tiene in coda la notifica se il telefono è spento.
// Un ordine di venti minuti fa non è più una notizia: meglio non recapitarlo affatto
// che far vibrare il telefono per qualcosa di già passato.
const TTL_BY_KIND: Record<PushKind, number> = {
  order: 300,        // 5 minuti
  waiter: 300,       // 5 minuti — il cliente sta aspettando ADESSO
  inventory: 3600,   // 1 ora — è un promemoria, non un'emergenza
  test: 60,
}

// `high` = "consegna subito, anche se lo schermo è spento". Ha un costo in batteria e
// va usata solo dove l'attesa è reale (sala, ordini). L'alert scorte può aspettare.
const URGENCY_BY_KIND: Record<PushKind, 'high' | 'normal'> = {
  order: 'high',
  waiter: 'high',
  inventory: 'normal',
  test: 'high',
}

export interface PushResult {
  sent: number
  failed: number
  /** Subscription cancellate perché l'endpoint è morto (404/410) o fallisce da troppo. */
  removed: number
  /** Presente quando non si è nemmeno provato: è un esito legittimo, non un errore. */
  skipped?: 'offline' | 'no-vapid' | 'no-subscriptions'
}

// Dopo questi fallimenti CONSECUTIVI la subscription si cancella anche senza un 410.
// Alcuni push service non dicono mai "morto": rispondono 500 all'infinito. Senza
// questo tetto la tabella accumula indirizzi che nessuno leggerà mai.
const MAX_CONSECUTIVE_FAILS = 10

// Timeout per singolo invio. Il default di web-push è quello di Node (nessuno):
// un push service che non risponde terrebbe aperto un handle a tempo indeterminato.
const SEND_TIMEOUT_MS = 8_000

/** Endpoint di un telefono, nella forma che il push service capisce. */
export interface PushTarget {
  endpoint: string
  keys: { p256dh: string; auth: string }
}

/**
 * Le due sole dipendenze verso il MONDO ESTERNO di questo modulo: la rete e il
 * verdetto su internet. Sono iniettabili perché è l'unico modo di verificare la
 * gestione degli errori (un 410 dal push service) senza bussare a un push service
 * vero — e la gestione degli errori è tutto ciò che questo modulo fa di rischioso.
 * In produzione nessuno passa `deps`: i default sono quelli reali.
 */
export interface PushDeps {
  send: (target: PushTarget, payload: string, ttl: number, urgency: 'high' | 'normal') => Promise<void>
  online: () => boolean
}

function realDeps(keys: VapidKeys): PushDeps {
  return {
    send: async (target, payload, ttl, urgency) => {
      await webpush.sendNotification(target, payload, {
        vapidDetails: { subject: keys.subject, publicKey: keys.publicKey, privateKey: keys.privateKey },
        TTL: ttl,
        urgency,
        timeout: SEND_TIMEOUT_MS,
      })
    },
    online: isOnline,
  }
}

/**
 * Recapita `n` a TUTTI i telefoni arruolati del ristorante. Non lancia mai.
 *
 * Cosa esclude, e perché:
 *  - internet giù → fast-fail immediato (nessuna connessione appesa);
 *  - sessioni SCADUTE → il join su `sessions` filtra per `expires_at > now()`;
 *  - sessioni REVOCATE → la riga non esiste più (CASCADE della 0018).
 */
export async function pushDispatch(restaurantId: string, n: PushNotification, deps?: Partial<PushDeps>): Promise<PushResult> {
  const empty: PushResult = { sent: 0, failed: 0, removed: 0 }
  try {
    // 1. Fast-fail: senza internet non esiste nessun push service raggiungibile.
    const online = deps?.online ?? isOnline
    if (!online()) return { ...empty, skipped: 'offline' }

    const keys = getVapidKeys()
    if (!keys) return { ...empty, skipped: 'no-vapid' }

    // 2. Destinatari: solo i telefoni con una sessione mobile ANCORA VALIDA.
    const rows = await db
      .select({
        id: pushSubscriptions.id,
        endpoint: pushSubscriptions.endpoint,
        p256dh: pushSubscriptions.p256dh,
        auth: pushSubscriptions.auth,
        failCount: pushSubscriptions.failCount,
      })
      .from(pushSubscriptions)
      .innerJoin(sessions, eq(pushSubscriptions.sessionId, sessions.id))
      .where(and(eq(pushSubscriptions.restaurantId, restaurantId), gt(sessions.expiresAt, new Date())))

    if (!rows.length) return { ...empty, skipped: 'no-subscriptions' }

    const payload = JSON.stringify({ title: n.title, body: n.body, url: n.url, tag: n.tag, kind: n.kind })
    const send = deps?.send ?? realDeps(keys).send

    // 3. Invio in parallelo: i telefoni di un ristorante sono unità, non migliaia, e
    // allSettled garantisce che un fallimento non annulli gli altri invii.
    const outcomes = await Promise.allSettled(rows.map(async (r) => {
      try {
        await send(
          { endpoint: r.endpoint, keys: { p256dh: r.p256dh, auth: r.auth } },
          payload,
          TTL_BY_KIND[n.kind],
          URGENCY_BY_KIND[n.kind],
        )
        // Successo: azzera il contatore dei fallimenti consecutivi.
        await db.update(pushSubscriptions)
          .set({ lastSuccessAt: new Date(), failCount: 0 })
          .where(eq(pushSubscriptions.id, r.id))
        return 'sent' as const
      } catch (err: unknown) {
        const status = (err as { statusCode?: number })?.statusCode
        // 404/410 = l'endpoint NON ESISTE PIÙ (app disinstallata, permesso revocato,
        // subscription scaduta). È la sola risposta che autorizza a cancellare subito.
        if (status === 404 || status === 410) {
          await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, r.id))
          return 'removed' as const
        }
        const next = r.failCount + 1
        if (next >= MAX_CONSECUTIVE_FAILS) {
          await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, r.id))
          return 'removed' as const
        }
        await db.update(pushSubscriptions)
          .set({ failCount: sql`${pushSubscriptions.failCount} + 1` })
          .where(eq(pushSubscriptions.id, r.id))
        return 'failed' as const
      }
    }))

    const result = { ...empty }
    for (const o of outcomes) {
      // Un rejected qui significa che è fallita la SCRITTURA a DB nel ramo di
      // gestione, non l'invio: contarlo come fallimento è l'interpretazione onesta.
      if (o.status !== 'fulfilled') { result.failed++; continue }
      if (o.value === 'sent') result.sent++
      else if (o.value === 'removed') result.removed++
      else result.failed++
    }
    return result
  } catch {
    // DB irraggiungibile, tabella mancante, qualunque cosa: la push non è mai un
    // motivo valido per far fallire ciò che l'ha generata.
    return empty
  }
}

/**
 * Invia DOPO che la risposta HTTP è partita.
 *
 * `setImmediate` scarica il lavoro sul giro successivo dell'event loop: quando la
 * callback parte, Fastify ha già scritto la risposta sul socket. È il vincolo di
 * F3.2 ("la push va dopo la risposta, mai prima") reso strutturale invece che
 * affidato alla disciplina di chi scrive la route.
 */
export function pushAfterResponse(restaurantId: string, n: PushNotification): void {
  setImmediate(() => { void pushDispatch(restaurantId, n) })
}

// ─── Fabbriche delle tre notifiche (F3.2) ────────────────────────────────────────
// Testo e deep-link vivono QUI, non nelle route: le route sanno di ordini e scorte,
// non di come si scrive una notifica. Il deep-link è un fragment perché l'app owner
// è una SPA a sezioni (`#ordini`, `#sala`, `#altro`) — il service worker lo legge in
// `notificationclick` e mette a fuoco la finestra già aperta invece di aprirne un'altra.

/** Ordine nuovo (staff o cliente). */
export function orderNewNotification(o: { tableNumber?: string | null; type?: string | null; total?: unknown }): PushNotification {
  const where = o.tableNumber ? `Tavolo ${o.tableNumber}` : o.type === 'takeaway' ? 'Asporto' : 'Nuovo ordine'
  const total = Number(o.total)
  const amount = Number.isFinite(total) && total > 0 ? ` · € ${total.toFixed(2)}` : ''
  return {
    title: 'Nuovo ordine',
    body: `${where}${amount}`,
    url: '/owner/#ordini',
    tag: 'order',
    kind: 'order',
  }
}

/** Chiamata del cliente dal tavolo. */
export function waiterCalledNotification(w: { tableNumber?: string | null; type?: string | null }): PushNotification {
  const what = w.type === 'bill' ? 'chiede il conto' : w.type === 'water' ? 'chiede acqua' : 'chiama il cameriere'
  const who = w.tableNumber ? `Tavolo ${w.tableNumber}` : 'Un tavolo'
  return {
    title: 'Chiamata dal tavolo',
    body: `${who} ${what}`,
    url: '/owner/#sala',
    tag: 'waiter',
    kind: 'waiter',
  }
}

/** Scorta sotto la soglia minima. */
export function inventoryAlertNotification(i: { name: string; quantity: unknown; unit?: string | null }): PushNotification {
  const q = Number(i.quantity)
  const qty = Number.isFinite(q) ? `${q}${i.unit ? ` ${i.unit}` : ''}` : 'sotto soglia'
  return {
    title: 'Scorta in esaurimento',
    body: `${i.name}: ${qty}`,
    url: '/owner/#altro',
    tag: `inventory`,
    kind: 'inventory',
  }
}
