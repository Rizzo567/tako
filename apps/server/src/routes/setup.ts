// Setup pairing dell'APPLIANCE LOCALE col control-plane (modo `local`).
// Espone gli endpoint che la dashboard staff usa per accoppiare il box al cloud e
// impostare la credenziale owner LOCALE per il login offline (MASTER_PLAN §5, SEC-001).
//
// Vive SOLO in modo local (queste route non vengono montate in TAKO_MODE=cloud).
// NON tocca lo staff/PIN né il cliente: aggiunge solo l'identità owner sincronizzata.
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { db, users, restaurants } from '@tako/db'
import { eq, and } from 'drizzle-orm'
import {
  claim,
  heartbeat,
  ownerSnapshot,
  pairingState,
  isPairingConfigured,
  resetPairing,
} from '../lib/cloud-client.js'

// Credenziale owner LOCALE: password dedicata al login offline. Policy allineata al
// register esistente (min 8). NON è il password cloud: è specifica di questo box.
const pairSchema = z.object({
  code: z.string().min(8).max(200),
  localPassword: z.string().min(8).max(72),
})

const setLocalPwSchema = z.object({
  localPassword: z.string().min(8).max(72),
})

export async function setupRoutes(fastify: FastifyInstance) {
  // ─── GET /status — stato pairing per la UI (nessun segreto) ────────────────────
  fastify.get('/status', async () => ({ data: pairingState() }))

  // ─── POST /pair — claim del device code + crea/aggiorna owner + set credenziale ──
  // Flusso: l'owner genera il device code sul sito cloud (dashboard control-plane) e
  // lo trascrive qui insieme alla password owner LOCALE per l'accesso offline.
  fastify.post('/pair', async (req, reply) => {
    if (!isPairingConfigured()) {
      return reply.code(400).send({ error: { code: 'NOT_CONFIGURED', message: 'Pairing cloud non configurato (CLOUD_BASE_URL assente).' } })
    }
    const parsed = pairSchema.safeParse(req.body)
    if (!parsed.success) {
      return reply.code(400).send({ error: { code: 'VALIDATION', message: 'Codice o password non validi (password min 8 caratteri).' } })
    }

    // 1) Claim verso il cloud (riceve SOLO snapshot non-segreto — mai password_hash).
    const result = await claim(parsed.data.code)
    if (!result.ok) {
      return reply.code(400).send({ error: { code: 'PAIRING_FAILED', message: result.error ?? 'Pairing non riuscito.' } })
    }

    const snap = ownerSnapshot()
    if (!snap || !snap.cloudOwnerId) {
      return reply.code(500).send({ error: { code: 'SERVER_ERROR', message: 'Bundle di pairing incompleto.' } })
    }

    try {
      // 2) Risolvi/crea il ristorante locale legato a questa appliance. Riusiamo il primo
      // ristorante esistente sul box se presente (installazione singola), altrimenti lo
      // creiamo dallo snapshot. NB: non tocchiamo packages/db — usiamo i campi presenti.
      let [restaurant] = await db.select().from(restaurants).limit(1)
      if (!restaurant) {
        const slug = `tako-${snap.cloudOwnerId.slice(0, 8)}`
        ;[restaurant] = await db.insert(restaurants).values({
          name: snap.name || 'Il mio ristorante',
          slug,
          plan: 'free',
        }).returning()
      }

      // 3) Credenziale owner LOCALE dedicata (bcrypt). Salvata in local_owner_secret_hash.
      const localHash = await bcrypt.hash(parsed.data.localPassword, 12)
      const ownerEmail = (snap.email ?? `owner-${snap.cloudOwnerId.slice(0, 8)}@local`).toLowerCase()

      // 4) Upsert dell'owner sincronizzato. Match preferito per cloud_owner_id, poi email.
      const [byCloud] = await db.select().from(users).where(eq(users.cloudOwnerId, snap.cloudOwnerId)).limit(1)
      const [byEmail] = byCloud ? [byCloud] : await db.select().from(users).where(eq(users.email, ownerEmail)).limit(1)
      const existing = byCloud ?? byEmail

      if (existing) {
        await db.update(users).set({
          cloudOwnerId: snap.cloudOwnerId,
          email: ownerEmail,
          name: snap.name || existing.name,
          role: 'owner',
          localOwnerSecretHash: localHash,
          credentialsVersion: snap.credentialsVersion,
          emailVerified: true, // il cloud è la sorgente di verità: owner sincronizzato = verificato
          active: true,
        }).where(eq(users.id, existing.id))
      } else {
        await db.insert(users).values({
          restaurantId: restaurant!.id,
          name: snap.name || 'Titolare',
          email: ownerEmail,
          role: 'owner',
          cloudOwnerId: snap.cloudOwnerId,
          localOwnerSecretHash: localHash,
          credentialsVersion: snap.credentialsVersion,
          emailVerified: true,
        })
      }

      return reply.send({
        data: {
          paired: true,
          owner: { email: ownerEmail, name: snap.name },
          restaurant: { id: restaurant!.id, name: restaurant!.name },
        },
      })
    } catch (err: any) {
      fastify.log.error({ code: err?.code }, 'Setup pairing DB error')
      if (err?.code === '23505') {
        return reply.code(409).send({ error: { code: 'CONFLICT', message: 'Email owner già in uso da un altro utente locale.' } })
      }
      return reply.code(500).send({ error: { code: 'SERVER_ERROR', message: 'Errore interno durante il pairing.' } })
    }
  })

  // ─── POST /local-password — (ri)imposta la credenziale owner locale ─────────────
  // Utile dopo un refresh credentials_version o per cambiare la password offline.
  // Richiede che l'appliance sia già accoppiata.
  fastify.post('/local-password', async (req, reply) => {
    const snap = ownerSnapshot()
    if (!snap?.cloudOwnerId) {
      return reply.code(400).send({ error: { code: 'NOT_PAIRED', message: 'Appliance non accoppiata.' } })
    }
    const parsed = setLocalPwSchema.safeParse(req.body)
    if (!parsed.success) {
      return reply.code(400).send({ error: { code: 'VALIDATION', message: 'Password non valida (min 8 caratteri).' } })
    }
    const [owner] = await db.select().from(users).where(eq(users.cloudOwnerId, snap.cloudOwnerId)).limit(1)
    if (!owner) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Owner non trovato.' } })
    const localHash = await bcrypt.hash(parsed.data.localPassword, 12)
    await db.update(users).set({
      localOwnerSecretHash: localHash,
      credentialsVersion: snap.credentialsVersion,
    }).where(eq(users.id, owner.id))
    return reply.send({ data: { updated: true } })
  })

  // ─── POST /heartbeat — sincronizza credentials_version col cloud (best-effort) ──
  // Online: se il cloud ha bumpato (reset/cambio pw), invalidiamo il login offline
  // marcando l'owner locale (lo segnaliamo con localOwnerSecretHash=null → relogin).
  fastify.post('/heartbeat', async (_req, reply) => {
    const snap = ownerSnapshot()
    if (!snap?.cloudOwnerId) {
      return reply.code(400).send({ error: { code: 'NOT_PAIRED', message: 'Appliance non accoppiata.' } })
    }
    const hb = await heartbeat()
    if (hb.action === 'revoke') {
      // Appliance revocata dal cloud: rimuovi la credenziale offline e marca lo stato.
      await db.update(users).set({ localOwnerSecretHash: null }).where(eq(users.cloudOwnerId, snap.cloudOwnerId))
      resetPairing()
      return reply.send({ data: { action: 'revoke' } })
    }
    if (hb.action === 'refresh') {
      // Il cloud ha bumpato credentials_version (reset/cambio pw owner): la credenziale
      // offline NON è più valida → richiedi all'owner di reimpostarla (set-local-password).
      await db.update(users).set({ localOwnerSecretHash: null }).where(eq(users.cloudOwnerId, snap.cloudOwnerId))
      return reply.send({ data: { action: 'refresh' } })
    }
    return reply.send({ data: { action: hb.action } })
  })

  // ─── POST /unpair — dimentica il pairing su questo box ──────────────────────────
  fastify.post('/unpair', async (_req, reply) => {
    const snap = ownerSnapshot()
    if (snap?.cloudOwnerId) {
      await db.update(users).set({ localOwnerSecretHash: null }).where(eq(users.cloudOwnerId, snap.cloudOwnerId))
    }
    resetPairing()
    return reply.send({ data: { unpaired: true } })
  })
}

// Avvio periodico dell'heartbeat (best-effort) per propagare credentials_version.
// Non blocca l'avvio: se offline, non fa nulla. Chiamato da index.ts in modo local.
export function startHeartbeatLoop(fastify: FastifyInstance) {
  if (!isPairingConfigured()) return
  const HEARTBEAT_INTERVAL_MS = 15 * 60 * 1000 // 15 minuti
  const tick = async () => {
    try {
      const snap = ownerSnapshot()
      if (!snap?.cloudOwnerId) return
      const hb = await heartbeat()
      if (hb.action === 'refresh' || hb.action === 'revoke') {
        await db.update(users).set({ localOwnerSecretHash: null }).where(eq(users.cloudOwnerId, snap.cloudOwnerId))
        if (hb.action === 'revoke') resetPairing()
      }
    } catch {
      // Best-effort: l'offline non è un errore (SEC-007 degrado controllato).
    }
  }
  // Primo colpo dopo 30s (lascia avviare il server), poi a intervalli.
  const t0 = setTimeout(tick, 30000)
  const t1 = setInterval(tick, HEARTBEAT_INTERVAL_MS)
  fastify.addHook('onClose', async () => { clearTimeout(t0); clearInterval(t1) })
}
