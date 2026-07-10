import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { nanoid } from 'nanoid'
import { randomUUID } from 'node:crypto'
import { db, restaurants, menus, menuSections, menuItems, itemVariants, tables, orders, orderItems, tableSessions, bills } from '@tako/db'
import { eq, and, asc, inArray, isNull, desc, gte } from 'drizzle-orm'
import { io } from '../index.js'
import type { PublicRestaurant, PublicMenu } from '@tako/types'
import { autoPrintOrder } from '../lib/printer.js'
import { TABLE_COOKIE, authCookieOptions, TABLE_SESSION_MAX_AGE } from '../lib/cookies.js'
import { round2, ensureOpenBill } from '../lib/billing.js'
import { runAssistant } from '../lib/ai-actions.js'

// Sessione cliente incapsulata nel JWT del cookie tako_table.
//  • kind 'table'    → legata a un tavolo scansionato (tableId reale).
//  • kind 'takeaway' → asporto senza tavolo (tableId null); scoped solo al ristorante.
// `visitStart` = istante (ms) di emissione del JWT: è il perno di M6 (revoca per-visita):
// se un conto del tavolo viene CHIUSO dopo questo istante, il JWT è considerato scaduto
// (il cliente precedente se n'è andato) senza dover ruotare il qrToken stampato.
// `sid` = identificativo univoco della VISITA asporto (uuid random, emesso alla
// creazione della sessione takeaway). Gli ordini asporto lo memorizzano
// (orders.takeawaySessionId): GET /orders/:id filtra anche per sid, così una
// sessione asporto legge SOLO i propri ordini (fix IDOR), non qualsiasi ordine
// takeaway del ristorante conoscendone l'UUID.
interface TableSession { restaurantId: string; tableId: string | null; sessionId: string | null; qrToken?: string; tableNumber?: string | null; kind?: 'table' | 'takeaway'; visitStart?: number; sid?: string }

// Tetto giornaliero aggregato per ristorante sulle chiamate AI (Groq): impedisce
// l'amplificazione di costo via QR-scan ripetuti (cookie multipli) che bypassano
// il rate-limit per-tavolo. In-memory (reset al riavvio): è un freno economico,
// non un contatore contabile. Override via AI_DAILY_CAP.
const DAILY_AI_CAP = Number(process.env['AI_DAILY_CAP'] ?? 2000)
const aiDailyUsage = new Map<string, { day: string; count: number }>()
function bumpAiUsage(restaurantId: string): number {
  const day = new Date().toISOString().slice(0, 10)
  const rec = aiDailyUsage.get(restaurantId)
  if (!rec || rec.day !== day) { aiDailyUsage.set(restaurantId, { day, count: 1 }); return 1 }
  rec.count++
  return rec.count
}

export async function customerRoutes(fastify: FastifyInstance) {
  // Verifica il JWT del tavolo (cookie HttpOnly emesso al resolve del QR) e lega
  // l'azione al tavolo scansionato. Se il body porta restaurantId/tableId, devono
  // combaciare col JWT (anti-spoofing).
  async function requireTableSession(req: any, reply: any) {
    const token = req.cookies?.[TABLE_COOKIE]
    if (!token) return reply.code(401).send({ error: { code: 'NO_TABLE_SESSION', message: 'Scansiona di nuovo il QR del tavolo.' } })
    let payload: TableSession
    try {
      payload = fastify.jwt.verify(token) as TableSession
    } catch {
      return reply.code(401).send({ error: { code: 'INVALID_TABLE_SESSION', message: 'Sessione tavolo scaduta. Riscansiona il QR.' } })
    }
    const body = (req.body ?? {}) as { restaurantId?: string; tableId?: string }
    if ((body.restaurantId && body.restaurantId !== payload.restaurantId) ||
        (body.tableId && body.tableId !== payload.tableId)) {
      return reply.code(403).send({ error: { code: 'TABLE_MISMATCH', message: 'Azione non consentita per questo tavolo.' } })
    }

    // Asporto (kind 'takeaway'): nessun tavolo. Validiamo solo che il ristorante sia
    // attivo e l'asporto abilitato; niente qrToken/visita da verificare.
    if (payload.kind === 'takeaway' || payload.tableId == null) {
      const [r] = await db.select({ id: restaurants.id, settings: restaurants.settings, active: restaurants.active })
        .from(restaurants).where(eq(restaurants.id, payload.restaurantId)).limit(1)
      if (!r || !r.active || ((r.settings as any)?.takeawayEnabled ?? false) !== true) {
        return reply.code(403).send({ error: { code: 'TAKEAWAY_DISABLED', message: 'Ordini da asporto non disponibili.' } })
      }
      // Preserva `sid` dal JWT: è il perno del filtro anti-IDOR su GET /orders/:id.
      req.tableSession = { ...payload, tableId: null, kind: 'takeaway', tableNumber: null }
      return
    }

    // Numero tavolo AUTORITATIVO dal DB (mai dal client): evita che un cliente
    // attribuisca ordini/chiamate a un altro tavolo passando un tableNumber falso.
    // Legge anche qrToken: difesa aggiuntiva per la rotazione MANUALE del QR (/qr/refresh).
    const [t] = await db.select({ number: tables.number, qrToken: tables.qrToken }).from(tables).where(eq(tables.id, payload.tableId)).limit(1)
    if (!t || t.qrToken !== payload.qrToken) {
      return reply.code(401).send({ error: { code: 'INVALID_TABLE_SESSION', message: 'Sessione tavolo scaduta. Riscansiona il QR.' } })
    }

    // ── M6: revoca per-VISITA senza toccare il qrToken stampato. ──────────────
    // Il JWT muore quando la VISITA finisce, cioè quando un conto del tavolo viene
    // chiuso DOPO l'emissione del token (visitStart). Il prossimo cliente riscansiona
    // lo stesso QR fisico e ottiene un token con visitStart più recente → valido.
    // Il conto chiuso è di per sé il marcatore di revoca (bills.closedAt), niente
    // stato extra e niente rotazione del qrToken.
    if (payload.visitStart) {
      const [closedSince] = await db.select({ id: bills.id }).from(bills)
        .where(and(
          eq(bills.restaurantId, payload.restaurantId),
          eq(bills.tableId, payload.tableId),
          eq(bills.status, 'closed'),
          gte(bills.closedAt!, new Date(payload.visitStart)),
        )).limit(1)
      if (closedSince) {
        return reply.code(401).send({ error: { code: 'VISIT_ENDED', message: 'Sessione tavolo terminata. Riscansiona il QR.' } })
      }
    }

    req.tableSession = { ...payload, tableNumber: t.number ?? null }
  }

  // Resolve table by QR token → return restaurant + table info.
  // Rate-limit di route (allineato a waiter-call/ai-chat): uno scan + qualche reload
  // sono ampiamente sotto soglia, ma si taglia lo spamming di sessioni/JWT.
  fastify.get('/table/:token', { config: { rateLimit: { max: 30, timeWindow: 60000 } } }, async (req, reply) => {
    const { token } = req.params as { token: string }

    const [table] = await db.select().from(tables).where(eq(tables.qrToken, token)).limit(1)
    if (!table) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Tavolo non trovato' } })

    const [restaurant] = await db.select().from(restaurants).where(eq(restaurants.id, table.restaurantId)).limit(1)
    if (!restaurant) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Ristorante non trovato' } })

    const settings = restaurant.settings as any ?? {}

    const pub: PublicRestaurant = {
      id: restaurant.id,
      name: restaurant.name,
      slug: restaurant.slug,
      logoUrl: restaurant.logoUrl ?? undefined,
      primaryColor: restaurant.primaryColor ?? '#ED7159',
      defaultLanguage: settings.defaultLanguage ?? 'it',
      languages: settings.languages ?? ['it'],
      aiEnabled: settings.aiEnabled ?? false,
    }

    // Record QR scan session, ma in modo IDEMPOTENTE per finestra: un reload/riapertura
    // della PWA entro 10 min non crea una nuova riga (evita bloat e inquinamento delle
    // metriche time-to-first-order). Si riusa l'ultima sessione recente non convertita.
    const [recent] = await db.select({ id: tableSessions.id }).from(tableSessions)
      .where(and(
        eq(tableSessions.tableId, table.id),
        isNull(tableSessions.firstOrderAt),
        gte(tableSessions.scannedAt, new Date(Date.now() - 10 * 60 * 1000)),
      ))
      .orderBy(desc(tableSessions.scannedAt))
      .limit(1)
    const session = recent ?? (await db.insert(tableSessions).values({
      restaurantId: table.restaurantId,
      tableId: table.id,
      tableNumber: table.number,
    }).returning({ id: tableSessions.id }))[0]

    // JWT legato al tavolo → cookie HttpOnly: lega le azioni cliente a questo tavolo.
    // `visitStart` (ms) àncora la validità alla VISITA corrente (M6): alla chiusura
    // del conto il token si invalida da solo, senza ruotare il qrToken stampato.
    const tableJwt = fastify.jwt.sign(
      { restaurantId: table.restaurantId, tableId: table.id, sessionId: session?.id ?? null, qrToken: table.qrToken, kind: 'table', visitStart: Date.now() },
      { expiresIn: '4h' },
    )
    // Path '/' (non '/api/customer'): copre comunque le route customer ma permette
    // di inviare il cookie anche sull'handshake /socket.io, così join:table può
    // verificare il JWT del tavolo. Resta HttpOnly + SameSite=Lax.
    reply.setCookie(TABLE_COOKIE, tableJwt, authCookieOptions(TABLE_SESSION_MAX_AGE, '/'))

    return {
      data: {
        restaurant: pub,
        table: { id: table.id, number: table.number, seats: table.seats, restaurantId: table.restaurantId },
        sessionId: session?.id ?? null,
      },
    }
  })

  // Apri una sessione ASPORTO (ordine-ahead / takeaway) senza tavolo. Emette un JWT
  // tako_table scoped SOLO al ristorante (tableId null, kind 'takeaway'): permette
  // al cliente di ordinare prima di arrivare, senza scansionare un QR tavolo.
  // Rate-limit di route: uno scan/apertura + qualche reload sono sotto soglia.
  fastify.post('/takeaway/:restaurantId/session', { config: { rateLimit: { max: 20, timeWindow: 60000 } } }, async (req, reply) => {
    const { restaurantId } = req.params as { restaurantId: string }
    const [restaurant] = await db.select().from(restaurants).where(and(eq(restaurants.id, restaurantId), eq(restaurants.active, true))).limit(1)
    if (!restaurant) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Ristorante non trovato' } })
    const settings = restaurant.settings as any ?? {}
    if ((settings.takeawayEnabled ?? false) !== true) {
      return reply.code(403).send({ error: { code: 'TAKEAWAY_DISABLED', message: 'Asporto non disponibile per questo ristorante.' } })
    }

    const pub: PublicRestaurant = {
      id: restaurant.id,
      name: restaurant.name,
      slug: restaurant.slug,
      logoUrl: restaurant.logoUrl ?? undefined,
      primaryColor: restaurant.primaryColor ?? '#ED7159',
      defaultLanguage: settings.defaultLanguage ?? 'it',
      languages: settings.languages ?? ['it'],
      aiEnabled: settings.aiEnabled ?? false,
    }

    // `sid` univoco per questa visita asporto: lega gli ordini creati da QUESTA
    // sessione (orders.takeawaySessionId) e permette a GET /orders/:id di ritornare
    // solo i propri (fix IDOR: senza sid, chiunque con una sessione asporto leggeva
    // qualsiasi ordine takeaway del ristorante conoscendone l'UUID).
    const takeawayJwt = fastify.jwt.sign(
      { restaurantId: restaurant.id, tableId: null, sessionId: null, kind: 'takeaway', visitStart: Date.now(), sid: randomUUID() },
      { expiresIn: '4h' },
    )
    reply.setCookie(TABLE_COOKIE, takeawayJwt, authCookieOptions(TABLE_SESSION_MAX_AGE, '/'))
    return { data: { restaurant: pub, takeaway: true } }
  })

  // Get public menu for restaurant
  fastify.get('/restaurant/:restaurantId/menu', async (req, reply) => {
    const { restaurantId } = req.params as { restaurantId: string }

    const allMenus = await db.select().from(menus).where(and(eq(menus.restaurantId, restaurantId), eq(menus.active, true))).orderBy(asc(menus.position))
    if (!allMenus.length) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Nessun menu attivo' } })

    const mainMenu = allMenus[0]!
    const sections = await db.select().from(menuSections).where(and(eq(menuSections.menuId, mainMenu.id), eq(menuSections.active, true))).orderBy(asc(menuSections.position))
    const items = await db.select().from(menuItems).where(and(eq(menuItems.restaurantId, restaurantId), eq(menuItems.available, true))).orderBy(asc(menuItems.position))
    // Perf: carica solo le varianti dei piatti di questo ristorante (prima leggeva
    // l'intera tabella itemVariants di tutti i ristoranti).
    const itemIds = items.map(i => i.id)
    const variants = itemIds.length ? await db.select().from(itemVariants).where(inArray(itemVariants.itemId, itemIds)) : []

    const pub: PublicMenu = {
      id: mainMenu.id,
      name: mainMenu.name,
      sections: sections.map(s => ({
        id: s.id,
        name: s.name,
        items: items
          .filter(i => i.sectionId === s.id)
          .map(i => ({
            id: i.id,
            name: i.name,
            description: i.description ?? undefined,
            price: i.price,
            imageUrl: i.imageUrl ?? undefined,
            allergens: i.allergens ?? [],
            tags: i.tags ?? [],
            available: i.available,
            variants: variants.filter(v => v.itemId === i.id).map(v => ({ id: v.id, name: v.name, priceModifier: v.priceModifier })),
          })),
      })),
    }

    return { data: pub }
  })

  // Submit order from customer.
  // Rate-limit per-route keyed sulla sessione tavolo (cookie), non per-IP: clienti
  // legittimi dietro lo stesso NAT/WiFi del ristorante non si strozzano a vicenda,
  // ma un singolo tavolo non può floodare stampa/cucina (autoPrint, emit, ensureOpenBill).
  fastify.post('/orders', {
    config: { rateLimit: { max: 8, timeWindow: 60000, keyGenerator: (req: any) => req.cookies?.[TABLE_COOKIE] ?? req.ip } },
    preHandler: requireTableSession,
  }, async (req, reply) => {
    const schema = z.object({
      restaurantId: z.string().uuid(),
      tableId: z.string().uuid().optional(),
      tableNumber: z.string().optional(),
      type: z.enum(['table', 'takeaway']).default('table'),
      items: z.array(z.object({
        menuItemId: z.string().uuid(),
        variantId: z.string().uuid().optional(),
        quantity: z.number().int().positive(),
        notes: z.string().optional(),
      })).min(1), // niente ordini vuoti
      notes: z.string().max(1000).optional(),
      customerName: z.string().max(80).optional(),   // asporto: nome per il ritiro
      idempotencyKey: z.string().min(8).max(128),
    })

    const body = schema.safeParse(req.body)
    if (!body.success) return reply.code(400).send({ error: { code: 'VALIDATION', message: body.error.message } })

    // SECURITY: identità tavolo/ristorante AUTORITATIVA dal JWT del tavolo (mai dal
    // client). Il TIPO ordine è derivato dal KIND della sessione, non dal body: un
    // cliente SEDUTO ordina sempre 'table' (i suoi ordini finiscono sul conto del
    // tavolo) — non può marcare 'takeaway' per sfuggire alla fatturazione. Una
    // sessione asporto (kind 'takeaway') produce sempre ordini takeaway senza tableId.
    const session = (req as any).tableSession as TableSession
    const restaurantId = session.restaurantId
    const isTakeaway = session.kind === 'takeaway'
    const type: 'table' | 'takeaway' = isTakeaway ? 'takeaway' : 'table'
    const tableId = isTakeaway ? null : session.tableId
    if (type === 'table' && !tableId) {
      return reply.code(400).send({ error: { code: 'NO_TABLE', message: 'Sessione tavolo non valida.' } })
    }

    // Idempotency check — scoped al ristorante: una chiave non deve mai risolvere
    // a un ordine di un altro tenant.
    const [existing] = await db.select().from(orders).where(and(eq(orders.idempotencyKey, body.data.idempotencyKey), eq(orders.restaurantId, restaurantId))).limit(1)
    if (existing) return { data: existing }

    // SECURITY: verifica che il ristorante esista e sia attivo
    const [restaurant] = await db.select().from(restaurants).where(and(eq(restaurants.id, restaurantId), eq(restaurants.active, true))).limit(1)
    if (!restaurant) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Ristorante non trovato' } })

    // SECURITY: verifica che il tavolo appartenga al ristorante (previene ordini cross-ristorante)
    if (tableId) {
      const [table] = await db.select().from(tables).where(and(eq(tables.id, tableId), eq(tables.restaurantId, restaurantId))).limit(1)
      if (!table) return reply.code(403).send({ error: { code: 'FORBIDDEN', message: 'Tavolo non valido' } })
    }

    // SECURITY: prezzi sempre dal DB, mai dal client — previene price tampering
    const dbItems = await db.select().from(menuItems).where(and(eq(menuItems.restaurantId, restaurantId), eq(menuItems.available, true)))

    // SECURITY: max 15 voci per ordine
    if (body.data.items.length > 15) return reply.code(400).send({ error: { code: 'TOO_MANY_ITEMS', message: 'Massimo 15 voci per ordine' } })

    // SECURITY: quantità massima per voce (anti-spam)
    if (body.data.items.some(i => i.quantity > 20)) return reply.code(400).send({ error: { code: 'QTY_TOO_HIGH', message: 'Quantità massima 20 per voce' } })

    // UX stellato: se una portata è diventata esaurita tra il caricamento del menu
    // e l'invio, rispondi con un errore pulito (non un 500) elencando i piatti.
    const unavailable = body.data.items.filter(oi => !dbItems.find(i => i.id === oi.menuItemId))
    if (unavailable.length) {
      return reply.code(409).send({ error: { code: 'ITEM_UNAVAILABLE', message: 'Alcuni piatti non sono più disponibili. Aggiorna il carrello.', items: unavailable.map(u => u.menuItemId) } })
    }

    // Varianti dal DB (es. "Litro +€13"): il priceModifier va aggiunto al prezzo,
    // altrimenti l'ordine è sotto-fatturato. Carico solo le varianti dei piatti ordinati.
    const orderedItemIds = body.data.items.map(i => i.menuItemId)
    const dbVariants = orderedItemIds.length
      ? await db.select().from(itemVariants).where(inArray(itemVariants.itemId, orderedItemIds))
      : []

    // SECURITY: una variantId passata deve esistere ED appartenere al suo piatto.
    const badVariant = body.data.items.find(oi =>
      oi.variantId && !dbVariants.find(v => v.id === oi.variantId && v.itemId === oi.menuItemId))
    if (badVariant) {
      return reply.code(409).send({ error: { code: 'VARIANT_INVALID', message: 'Variante non valida. Aggiorna il carrello.' } })
    }

    let total = 0
    const resolvedItems = body.data.items.map(orderItem => {
      const dbItem = dbItems.find(i => i.id === orderItem.menuItemId)! // garantito sopra
      const variant = orderItem.variantId ? dbVariants.find(v => v.id === orderItem.variantId) : undefined
      const unitPrice = round2(dbItem.price + (variant?.priceModifier ?? 0)) // prezzo + modificatore, dal DB
      total = round2(total + unitPrice * orderItem.quantity)
      // Nome variante nel nome della voce → arriva a cucina/stampa e nel payload socket.
      return { ...orderItem, name: variant ? `${dbItem.name} (${variant.name})` : dbItem.name, unitPrice, kitchenStation: dbItem.kitchenStation }
    })

    let order: typeof orders.$inferSelect | undefined
    try {
      ;[order] = await db.insert(orders).values({
        restaurantId,
        tableId,
        // tableNumber solo per ordini al tavolo (autoritativo dal JWT/DB); null per asporto.
        tableNumber: isTakeaway ? null : ((req as any).tableSession?.tableNumber ?? body.data.tableNumber),
        type,
        customerName: isTakeaway ? (body.data.customerName ?? null) : null,
        // ASPORTO: lega l'ordine alla VISITA asporto (sid dal JWT) per il fix IDOR.
        takeawaySessionId: isTakeaway ? (session.sid ?? null) : null,
        // conferma automatica se attivata nelle impostazioni del ristorante
        status: (restaurant?.settings as any)?.autoConfirm ? 'confirmed' : 'pending',
        total,
        notes: body.data.notes,
        idempotencyKey: body.data.idempotencyKey,
      }).returning()
    } catch (err: any) {
      // Race del doppio-tap: due invii con lo stesso idempotencyKey arrivano
      // insieme, entrambi superano il check iniziale, ma il vincolo UNIQUE blocca
      // il secondo. Niente 500: ritorna l'ordine già creato (idempotenza reale).
      if (err?.code === '23505') {
        const [existingOrder] = await db.select().from(orders).where(and(eq(orders.idempotencyKey, body.data.idempotencyKey), eq(orders.restaurantId, restaurantId))).limit(1)
        if (existingOrder) {
          const items = await db.select().from(orderItems).where(eq(orderItems.orderId, existingOrder.id))
          return reply.code(200).send({ data: { ...existingOrder, items } })
        }
      }
      throw err
    }

    const insertedItems = await db.insert(orderItems).values(
      resolvedItems.map(i => ({
        orderId: order!.id,
        menuItemId: i.menuItemId,
        variantId: i.variantId,
        name: i.name,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        notes: i.notes,
        kitchenStation: i.kitchenStation ?? null,
        status: 'pending' as const,
      }))
    ).returning()

    // ── ASPORTO: 1 ordine = 1 CONTO = 1 pagamento al ritiro. ──────────────────
    // L'ordine takeaway (senza tavolo) genera un conto dedicato (tableId null) che
    // compare in Cassa come ticket asporto (GET /bills/open ritorna anche i no-table).
    // Il cliente paga AL BANCO col flusso pagamenti esistente (POST /bills/:id/payments):
    // quella chiusura fa la cascade dell'ordine → 'paid', che così entra in
    // incasso/statistiche come un tavolo. Niente coperto sull'asporto: total = subtotale.
    if (isTakeaway && order) {
      const [takeawayBill] = await db.insert(bills).values({
        restaurantId,
        tableId: null,
        tableNumber: null,
        covers: 1,
        subtotal: total,
        total,
        status: 'open',
      }).returning({ id: bills.id })
      if (takeawayBill) {
        await db.update(orders).set({ billId: takeawayBill.id }).where(eq(orders.id, order.id))
        order.billId = takeawayBill.id
      }
    }

    const payload = { ...order, items: insertedItems }

    // Auto-print comanda (fire-and-forget — non blocca risposta al cliente).
    // tableNumber AUTORITATIVO dal JWT/DB (come l'insert), non dal client: evita
    // spoof del ticket di cucina con un tavolo altrui.
    autoPrintOrder({
      restaurantId,
      tableNumber: (req as any).tableSession?.tableNumber ?? body.data.tableNumber,
      items: insertedItems.map(i => ({ name: i.name, quantity: i.quantity, notes: i.notes ?? undefined })),
    }).catch(() => {}) // errore stampante non deve rompere l'ordine

    // Emit to restaurant room (staff devices)
    io.to(`restaurant:${restaurantId}`).emit('order:new', payload)

    // Update table status
    if (tableId) {
      await db.update(tables).set({ status: 'occupied', openedAt: new Date() }).where(eq(tables.id, tableId))
      io.to(`restaurant:${restaurantId}`).emit('table:updated', { tableId, status: 'occupied' })
    }

    // Conto aperto get-or-create atomico (advisory lock per tavolo): evita conti
    // duplicati e subtotali incoerenti quando più ordini arrivano insieme.
    if (tableId) {
      await ensureOpenBill(restaurantId, tableId)
    }

    // Mark first order on session (only if not already recorded)
    if (tableId) {
      const [session] = await db
        .select()
        .from(tableSessions)
        .where(and(
          eq(tableSessions.tableId, tableId),
          eq(tableSessions.restaurantId, restaurantId),
          isNull(tableSessions.firstOrderAt),
        ))
        .orderBy(desc(tableSessions.scannedAt))
        .limit(1)

      if (session) {
        const elapsedSec = Math.round((Date.now() - session.scannedAt.getTime()) / 1000)
        await db
          .update(tableSessions)
          .set({ firstOrderAt: new Date(), timeToFirstOrderSec: elapsedSec })
          .where(eq(tableSessions.id, session.id))
      }
    }

    return reply.code(201).send({ data: payload })
  })

  // Get order status (for customer tracking). SECURITY: richiede la sessione del
  // tavolo (cookie tako_table) e ritorna SOLO ordini del proprio tavolo —
  // altrimenti chiunque potrebbe leggere ordini di qualsiasi ristorante by-id (IDOR).
  fastify.get('/orders/:orderId', { preHandler: requireTableSession }, async (req: any, reply) => {
    const { orderId } = req.params as { orderId: string }
    const { restaurantId, tableId, kind, sid } = req.tableSession as TableSession
    // Sessione al tavolo → solo ordini del proprio tavolo (anti-IDOR). Sessione
    // asporto (tableId null) → solo ordini takeaway creati da QUESTA visita (sid),
    // NON qualsiasi ordine takeaway del ristorante: senza il filtro sid chiunque con
    // una sessione asporto poteva leggere l'ordine altrui conoscendone l'UUID (IDOR).
    // sid mancante (token asporto legacy pre-migrazione) → nessun match → 404.
    const scopeFilter = kind === 'takeaway' || tableId == null
      ? and(eq(orders.restaurantId, restaurantId), eq(orders.type, 'takeaway'), eq(orders.takeawaySessionId, sid ?? '00000000-0000-0000-0000-000000000000'))
      : and(eq(orders.restaurantId, restaurantId), eq(orders.tableId, tableId))
    const [order] = await db.select().from(orders)
      .where(and(eq(orders.id, orderId), scopeFilter))
      .limit(1)
    if (!order) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Ordine non trovato' } })
    const items = await db.select().from(orderItems).where(eq(orderItems.orderId, orderId))
    return { data: { ...order, items } }
  })

  // Call waiter
  fastify.post('/waiter-call', { config: { rateLimit: { max: 6, timeWindow: 60000, keyGenerator: (req: any) => req.cookies?.[TABLE_COOKIE] ?? req.ip } }, preHandler: requireTableSession }, async (req, reply) => {
    const schema = z.object({
      restaurantId: z.string().uuid(),
      tableId: z.string().uuid(),
      tableNumber: z.string().max(20),
      type: z.enum(['help', 'bill', 'water']),
    })
    const body = schema.safeParse(req.body)
    if (!body.success) return reply.code(400).send({ error: { code: 'VALIDATION', message: body.error.message } })
    const { restaurantId, tableId, type } = body.data
    // tableNumber autoritativo dal JWT/tavolo, non dal client.
    const tableNumber = (req as any).tableSession?.tableNumber ?? body.data.tableNumber
    io.to(`restaurant:${restaurantId}`).emit('waiter:called', { tableId, tableNumber, type })
    return { data: { success: true } }
  })

  // AI chat — agentic assistant. Bound to this table/session: it can search the
  // menu, fill the cart, place the order, check status and call the waiter.
  fastify.post('/ai-chat', { config: { rateLimit: { max: 15, timeWindow: 60000, keyGenerator: (req: any) => req.cookies?.[TABLE_COOKIE] ?? req.ip } }, preHandler: requireTableSession }, async (req, reply) => {
    const aiChatSchema = z.object({
      restaurantId: z.string().uuid(),
      message: z.string().min(1).max(500),
      tableId: z.string().uuid().optional(),
      tableNumber: z.string().max(20).optional(),
      sessionId: z.string().uuid().optional(),
      history: z.array(z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().max(2000),
      })).max(12).default([]),
    })
    const parsed = aiChatSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: { code: 'VALIDATION', message: parsed.error.message } })
    const { restaurantId, message, history } = parsed.data
    // Identità tavolo AUTORITATIVA dal JWT (mai dal client): l'assistente AI può
    // creare ordini/chiamare il cameriere, quindi deve agire solo sul proprio tavolo.
    const session = (req as any).tableSession as TableSession
    const tableId = session.tableId
    const tableNumber = session.tableNumber ?? null

    const [restaurant] = await db.select().from(restaurants).where(eq(restaurants.id, restaurantId)).limit(1)
    if (!restaurant) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Ristorante non trovato' } })
    // Gate server-side sul setting amministrativo: il pulsante AI lato client dipende
    // da aiEnabled (esposto in PublicRestaurant), ma senza questo controllo una
    // chiamata diretta forzerebbe Groq anche con AI disattivata dall'owner.
    if (((restaurant.settings as any)?.aiEnabled ?? false) !== true) {
      return reply.code(403).send({ error: { code: 'AI_DISABLED', message: 'AI non abilitata per questo ristorante' } })
    }

    // Tetto giornaliero aggregato per ristorante: chiude il bypass via cookie multipli
    // (QR-scan ripetuti) che eluderebbe il rate-limit per-tavolo.
    if (bumpAiUsage(restaurantId) > DAILY_AI_CAP) {
      return reply.code(429).send({ error: { code: 'AI_QUOTA', message: 'Assistente non disponibile, riprova più tardi.' } })
    }

    // Assistente cliente AGENTICO su Groq: oltre a consigliare, può aggiungere al
    // carrello (azione applicata dalla PWA), chiamare il cameriere e leggere lo stato
    // ordine — tutto scoped a QUESTO tavolo via il motore azioni condiviso.
    if (!process.env['GROQ_API_KEY']) return reply.code(503).send({ error: { code: 'AI_UNAVAILABLE', message: 'AI not configured' } })

    // menuContext troncato a 60 voci: il prompt non cresce illimitatamente col menu
    // (riduce anche i tool-call di ricerca per le richieste più comuni).
    const items = (await db.select().from(menuItems).where(and(eq(menuItems.restaurantId, restaurantId), eq(menuItems.available, true)))).slice(0, 60)
    const menuContext = items.map(i => `${i.name}: €${i.price}${i.description ? ` — ${i.description}` : ''}${i.allergens?.length ? ` [Allergeni: ${i.allergens.join(', ')}]` : ''}`).join('\n')
    const isTakeaway = session.kind === 'takeaway'
    const systemPrompt = `Sei Tako, l'assistente del ristorante "${restaurant?.name ?? 'questo ristorante'}".
Aiuti il cliente e puoi AGIRE con gli strumenti: cerca nel menu, aggiungi piatti al carrello${isTakeaway ? '' : ', chiama il cameriere, controlla lo stato dell\'ordine'}.
Regole: rispondi in italiano, cordiale e breve (max 3 righe). Se il cliente vuole ordinare, usa add_to_cart (poi conferma lui dal carrello). Non inventare piatti né prezzi: usa solo il menu qui sotto.
Menu:\n${menuContext}`
    const allow = isTakeaway ? ['search_menu', 'add_to_cart'] : ['search_menu', 'add_to_cart', 'call_waiter', 'order_status']

    try {
      const turn = await runAssistant({
        scope: 'customer',
        ctx: { restaurantId, tableId, tableNumber, role: 'customer' },
        systemPrompt, history, userMessage: message, allow,
      })
      return { data: { message: turn.message, actions: turn.actions } }
    } catch (err: any) {
      if (err?.code === 'AI_UNAVAILABLE') return reply.code(503).send({ error: { code: 'AI_UNAVAILABLE', message: 'AI non configurata' } })
      fastify.log.error(err, 'customer ai-chat error')
      return reply.code(502).send({ error: { code: 'AI_ERROR', message: 'Assistente non disponibile, riprova.' } })
    }
  })
}
