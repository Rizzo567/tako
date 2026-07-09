import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { db, bills, billPayments, orders, tables } from '@tako/db'
import { eq, and, inArray, gte, desc, sql } from 'drizzle-orm'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { io } from '../index.js'
import { round2, BILLABLE_STATUSES, coverUnit, billTotalsFromOrders, restaurantTimezone, dayKeyInTz, dayStartInTz } from '../lib/billing.js'

export async function billRoutes(fastify: FastifyInstance) {
  // Get open bills. Ritorna anche i conti SENZA tavolo (asporto / conto libero):
  // la Cassa li vede e li può incassare. Per i no-table, allega l'eventuale ordine
  // asporto collegato (orders.billId) così la SPA li etichetta "Asporto · <nome>"
  // invece di "Tavolo —" (campi extra `takeaway`/`customerName`, additivi).
  fastify.get('/open', { preHandler: requireAuth }, async (req) => {
    const open = await db.select().from(bills).where(and(eq(bills.restaurantId, req.user!.restaurantId), eq(bills.status, 'open'))).orderBy(desc(bills.createdAt))
    const noTableIds = open.filter(b => b.tableId == null).map(b => b.id)
    if (noTableIds.length === 0) return { data: open }
    const linked = await db
      .select({ billId: orders.billId, customerName: orders.customerName, type: orders.type })
      .from(orders)
      .where(inArray(orders.billId, noTableIds))
    const byBill = new Map(linked.map(o => [o.billId, o]))
    return {
      data: open.map(b => {
        if (b.tableId != null) return b
        const o = byBill.get(b.id)
        return o ? { ...b, takeaway: o.type === 'takeaway', customerName: o.customerName } : b
      }),
    }
  })

  // Create bill for table
  fastify.post('/', { preHandler: requireAuth }, async (req, reply) => {
    const schema = z.object({
      tableId: z.string().uuid().optional(),
      tableNumber: z.string().optional(),
      covers: z.number().int().min(1).optional(),   // default = posti del tavolo
      discount: z.number().min(0).default(0),       // niente sconti negativi
      discountNote: z.string().max(500).optional(),
      tip: z.number().min(0).default(0),            // niente mance negative
    })
    const body = schema.safeParse(req.body)
    if (!body.success) return reply.code(400).send({ error: { code: 'VALIDATION', message: body.error.message } })
    const restaurantId = req.user!.restaurantId

    // Se arriva solo il NUMERO del tavolo (es. "Nuovo conto" dalla cassa), risolvi
    // il tableId reale: senza di esso il subtotale resterebbe a 0.
    if (!body.data.tableId && body.data.tableNumber) {
      const [t] = await db.select({ id: tables.id }).from(tables)
        .where(and(eq(tables.restaurantId, restaurantId), eq(tables.number, body.data.tableNumber))).limit(1)
      if (!t) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Tavolo non trovato' } })
      body.data.tableId = t.id
    }

    const tableId = body.data.tableId
    if (tableId) {
      // Anti cross-tenant: il tavolo deve appartenere al ristorante dell'utente.
      const [table] = await db.select({ id: tables.id, seats: tables.seats }).from(tables)
        .where(and(eq(tables.id, tableId), eq(tables.restaurantId, restaurantId))).limit(1)
      if (!table) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Tavolo non trovato' } })

      const unit = await coverUnit(restaurantId)
      // Advisory lock per (ristorante,tavolo) — STESSA chiave di ensureOpenBill: così
      // POST /bills e l'auto-apertura da ordine non possono creare due conti aperti sullo
      // stesso tavolo. Check(oldest)+insert serializzati.
      const result = await db.transaction(async (tx) => {
        await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${restaurantId + ':' + tableId}))`)
        const [existing] = await tx.select().from(bills).where(and(
          eq(bills.restaurantId, restaurantId), eq(bills.tableId, tableId), eq(bills.status, 'open'),
        )).orderBy(bills.createdAt).limit(1)
        if (existing) return { bill: existing, created: false }

        const tableOrders = await tx.select({ total: orders.total }).from(orders).where(and(
          eq(orders.tableId, tableId),
          eq(orders.restaurantId, restaurantId),
          inArray(orders.status, [...BILLABLE_STATUSES]),
        ))
        const subtotal = round2(tableOrders.reduce((sum, o) => sum + o.total, 0))
        const covers = body.data.covers ?? table.seats ?? 1
        const discount = Math.min(body.data.discount ?? 0, subtotal)
        const coverCharge = round2(covers * unit)
        const total = round2(subtotal - discount + (body.data.tip ?? 0) + coverCharge)
        const [created] = await tx.insert(bills).values({
          restaurantId, tableId, tableNumber: body.data.tableNumber,
          covers, discount, discountNote: body.data.discountNote, tip: body.data.tip ?? 0, subtotal, total,
        }).returning()
        return { bill: created!, created: true }
      })
      return reply.code(result.created ? 201 : 200).send({ data: result.bill })
    }

    // Nessun tavolo (conto libero): niente lock, subtotale 0.
    const discount = Math.min(body.data.discount ?? 0, 0)
    const total = round2(0 - discount + (body.data.tip ?? 0))
    const [bill] = await db.insert(bills).values({
      restaurantId,
      tableNumber: body.data.tableNumber,
      covers: body.data.covers ?? 1,
      discount, discountNote: body.data.discountNote, tip: body.data.tip ?? 0,
      subtotal: 0, total,
    }).returning()

    return reply.code(201).send({ data: bill })
  })

  // Aggiorna sconto / mancia di un conto aperto (ricalcola il totale).
  // requireRole('owner','cassiere'): lo sconto-a-zero (total=0) è il vero vettore di
  // frode — un dipendente/chef non deve poter azzerare un conto. La presa pagamenti
  // (POST /:billId/payments) resta requireAuth per non bloccare i camerieri.
  fastify.patch('/:billId', { preHandler: requireRole('owner', 'cassiere') }, async (req, reply) => {
    const { billId } = req.params as { billId: string }
    const schema = z.object({
      discount: z.number().min(0).optional(),
      discountNote: z.string().max(500).optional(),
      tip: z.number().min(0).optional(),
      covers: z.number().int().min(1).optional(),   // coperti reali → coperto nel totale
    })
    const body = schema.safeParse(req.body)
    if (!body.success) return reply.code(400).send({ error: { code: 'VALIDATION', message: body.error.message } })

    const [bill] = await db.select().from(bills)
      .where(and(eq(bills.id, billId), eq(bills.restaurantId, req.user!.restaurantId))).limit(1)
    if (!bill) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Conto non trovato' } })

    // Tetto sconto server-side: il cassiere è limitato al 30% del subtotale, sconti
    // oltre soglia restano prerogativa dell'owner. Lo sconto esistente non viene
    // ri-clampato se questa PATCH non lo modifica (es. aggiorna solo la mancia).
    const MAX_DISCOUNT_PCT = 0.30
    const unit = await coverUnit(req.user!.restaurantId)
    // Advisory lock sulla STESSA chiave di ensureOpenBill (ristorante:tavolo): senza,
    // questa PATCH riscriveva `total` da un `subtotal` stantìo e cancellava il ricalcolo
    // di un ordine arrivato in parallelo (mancia +€5 mentre entra un ordine da €30 →
    // total tornava a 55 e gli €30 sparivano). Asporto: lock sul conto.
    const lockKey = bill.tableId ? `${bill.restaurantId}:${bill.tableId}` : billId
    const updated = await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${lockKey}))`)
      const [locked] = await tx.select().from(bills).where(eq(bills.id, billId)).limit(1)
      if (!locked) return null
      // Subtotale FRESCO dagli ordini fatturabili sotto il lock.
      const base = await billTotalsFromOrders(tx, { ...locked, discount: 0, tip: 0 }, unit)
      const subtotal = base.subtotal
      let discount = locked.discount ?? 0
      if (body.data.discount !== undefined) {
        const cap = req.user!.role === 'owner' ? subtotal : round2(subtotal * MAX_DISCOUNT_PCT)
        discount = Math.min(body.data.discount, cap)
      }
      discount = Math.min(discount, subtotal) // total mai negativo
      const tip = body.data.tip ?? locked.tip ?? 0
      const covers = body.data.covers ?? locked.covers ?? 1
      const coverCharge = locked.tableId ? round2(covers * unit) : 0
      const total = round2(subtotal - discount + tip + coverCharge)
      // Audit: tracciabilità di chi modifica sconti sui conti.
      req.log.info({ userId: req.user!.id, billId, discount }, 'bill.discount')
      const [u] = await tx.update(bills)
        .set({ subtotal, discount, tip, covers, discountNote: body.data.discountNote ?? locked.discountNote, total })
        .where(eq(bills.id, billId)).returning()
      return u
    })
    if (!updated) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Conto non trovato' } })

    return { data: updated }
  })

  // Add payment to bill
  fastify.post('/:billId/payments', { preHandler: requireAuth }, async (req, reply) => {
    const { billId } = req.params as { billId: string }
    const schema = z.object({
      amount: z.number().positive(),
      method: z.enum(['cash', 'card', 'digital', 'split']),
      // M3: il cameriere (requireAuth su questa route) non può usare PATCH /bills/:id
      // (owner/cassiere). Permettergli la mancia QUI evita che il pagamento abortisca.
      tip: z.number().min(0).optional(),
    })
    const body = schema.safeParse(req.body)
    if (!body.success) return reply.code(400).send({ error: { code: 'VALIDATION', message: body.error.message } })

    // Verify bill belongs to this restaurant before accepting payment
    const [bill] = await db.select().from(bills).where(and(eq(bills.id, billId), eq(bills.restaurantId, req.user!.restaurantId))).limit(1)
    if (!bill) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Conto non trovato' } })
    // Non accettare pagamenti su un conto già chiuso/annullato: ri-processarlo
    // ri-eseguirebbe la chiusura (tavolo→cleaning, ordini→paid) e gonfierebbe i pagamenti.
    if (bill.status !== 'open') return reply.code(409).send({ error: { code: 'BILL_NOT_OPEN', message: 'Il conto non è aperto.' } })

    // Transazione + advisory lock per-conto: serializza ri-check stato + insert
    // pagamento + ricalcolo + chiusura/cascade, eliminando la TOCTOU di doppia
    // chiusura / doppio pagamento (coerente con ensureOpenBill).
    const { tip: tipInput, ...paymentData } = body.data
    // Lock sulla STESSA chiave di ensureOpenBill (ristorante:tavolo) per i conti al
    // tavolo: così un ordine in arrivo non può committare tra il ricalcolo del totale
    // e la chiusura del conto. Prima il pagamento lockava su hashtext(billId) mentre il
    // ricalcolo del totale gira sotto il lock del tavolo → un ordine appena inserito ma
    // non ancora sommato veniva comunque marcato 'paid' dalla cascade (cibo regalato).
    // Asporto (senza tavolo): nessun ordine tardivo, lock sul conto.
    const lockKey = bill.tableId ? `${bill.restaurantId}:${bill.tableId}` : billId
    const unit = await coverUnit(req.user!.restaurantId)
    const result = await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${lockKey}))`)

      // Ri-leggi lo stato DENTRO il lock: un'altra richiesta potrebbe aver appena chiuso il conto.
      const [locked] = await tx.select().from(bills).where(eq(bills.id, billId)).limit(1)
      if (!locked || locked.status !== 'open') return { conflict: true as const }

      // M3: mancia passata col pagamento (il cameriere non può usare PATCH /bills).
      const tip = tipInput !== undefined ? tipInput : (locked.tip ?? 0)
      // Ricalcola il totale dagli ordini fatturabili REALI sotto il lock: non fidarsi
      // di locked.total, che un ordine appena inserito potrebbe non riflettere ancora.
      // Persiste subtotal/discount/tip così la Cassa vede il valore corretto.
      const t = await billTotalsFromOrders(tx, { ...locked, tip }, unit)
      const effectiveTotal = t.total
      await tx.update(bills).set({ subtotal: t.subtotal, discount: t.discount, tip, total: effectiveTotal }).where(eq(bills.id, billId))

      const [payment] = await tx.insert(billPayments).values({ billId, ...paymentData, status: 'completed' }).returning()

      // Check if bill is fully paid (confronto a centesimi: niente derive float)
      const allPayments = await tx.select().from(billPayments).where(eq(billPayments.billId, billId))
      const paidTotal = round2(allPayments.filter(p => p.status === 'completed').reduce((s, p) => s + p.amount, 0))

      let closedTableId: string | null = null
      const paidOrderIds: string[] = []
      if (paidTotal >= effectiveTotal) {
        await tx.update(bills).set({ status: 'closed', closedAt: new Date(), closedBy: req.user!.id }).where(eq(bills.id, billId))
        if (locked.tableId) {
          // Chiusura conto: tavolo → pulizia, visita chiusa (openedAt reset).
          // NB: NON ruotiamo qui il qrToken — è il token stampato/plastificato sul
          // tavolo (customer route risolve GET /table/:token via tables.qrToken), e
          // rigenerarlo a ogni chiusura renderebbe morto il QR fisico.
          // ── M6 RISOLTO (revoca per-visita, senza toccare il qrToken): ──────────
          // Questa chiusura scrive bills.closedAt = adesso. I JWT tavolo del cliente
          // uscito contengono `visitStart` (istante di emissione). requireTableSession
          // (customer.ts) e join:table (handlers.ts) rifiutano ogni JWT per cui esiste
          // un conto CHIUSO del tavolo con closedAt > visitStart. Quindi CHIUDERE il
          // conto revoca da solo i token della visita, mentre il prossimo cliente che
          // riscansiona lo stesso QR fisico ottiene un JWT con visitStart più recente
          // (nessun conto chiuso successivo) → valido. Nessuno stato extra da scrivere.
          await tx.update(tables).set({ status: 'cleaning', openedAt: null }).where(eq(tables.id, locked.tableId))
          closedTableId = locked.tableId
        }
        // Auto-cascade: marca 'paid' ESATTAMENTE gli ordini sommati in effectiveTotal
        // (t.orderIds), non una ri-selezione dei billable del tavolo. Così un ordine
        // committato dopo il calcolo del totale (e quindi NON coperto dal pagamento)
        // non viene mai marcato paid: resta billable e finirà su un nuovo conto via
        // ensureOpenBill (che attende questo stesso lock). Marcarli 'paid' li esclude
        // da BILLABLE_STATUSES → niente ri-fatturazione di cibo già pagato.
        if (t.orderIds.length > 0) {
          const paidAt = new Date()
          for (const oid of t.orderIds) {
            await tx.update(orders).set({ status: 'paid', paidAt }).where(eq(orders.id, oid))
            paidOrderIds.push(oid)
          }
        }
      }
      return { conflict: false as const, payment, closedTableId, paidOrderIds }
    })

    if (result.conflict) return reply.code(409).send({ error: { code: 'BILL_NOT_OPEN', message: 'Il conto non è aperto.' } })

    // Emit DOPO il commit (stato consistente per i client).
    if (result.closedTableId) {
      io.to(`restaurant:${req.user!.restaurantId}`).emit('table:updated', { tableId: result.closedTableId, status: 'cleaning' })
    }
    // order:updated per OGNI ordine pagato — anche asporto (senza tavolo): la Cassa
    // deve veder sparire il ticket. La room table:* si emette solo se c'è un tavolo.
    for (const orderId of result.paidOrderIds) {
      io.to(`restaurant:${req.user!.restaurantId}`).emit('order:updated', { orderId, status: 'paid' })
      if (result.closedTableId) io.to(`table:${result.closedTableId}`).emit('order:updated', { orderId, status: 'paid' })
      // Cliente ASPORTO (senza tavolo): "pagato/ritirato" arriva sulla room dell'ordine.
      io.to(`order:${orderId}`).emit('order:updated', { orderId, status: 'paid' })
    }

    return reply.code(201).send({ data: result.payment })
  })

  // Get bill with payments
  fastify.get('/:billId', { preHandler: requireAuth }, async (req, reply) => {
    const { billId } = req.params as { billId: string }
    const [bill] = await db.select().from(bills).where(and(eq(bills.id, billId), eq(bills.restaurantId, req.user!.restaurantId))).limit(1)
    if (!bill) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Conto non trovato' } })
    const payments = await db.select().from(billPayments).where(eq(billPayments.billId, billId))
    return { data: { ...bill, payments } }
  })

  // Today summary
  fastify.get('/summary/today', { preHandler: requireAuth }, async (req) => {
    // "Oggi" nel fuso del ristorante (setting timezone, default Europe/Rome): allineato
    // a stats.ts così le due viste non divergono sul confine di mezzanotte.
    const tz = await restaurantTimezone(req.user!.restaurantId)
    const start = dayStartInTz(dayKeyInTz(new Date(), tz), tz)
    const closed = await db.select().from(bills).where(and(eq(bills.restaurantId, req.user!.restaurantId), eq(bills.status, 'closed'), gte(bills.closedAt!, start)))
    const revenue = closed.reduce((s, b) => s + b.total, 0)
    const tips = closed.reduce((s, b) => s + (b.tip ?? 0), 0)
    return { data: { revenue, tips, billsCount: closed.length, avgTicket: closed.length ? revenue / closed.length : 0 } }
  })
}
