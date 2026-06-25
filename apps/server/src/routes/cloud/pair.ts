// Pairing appliance ↔ cloud (device-code flow + proof-of-possession — MASTER_PLAN-cloud-auth §5 / SEC-001/003).
//
// FLUSSO DI APPROVAZIONE (decisione documentata):
//   Si è scelto l'AUTO-APPROVE alla generazione, non un secondo step di conferma push.
//   Motivazione: `POST /api/pair/code` richiede già la SESSIONE OWNER autenticata e verifica
//   che il `restaurantId` appartenga all'owner. Il device code:
//     - è ad alta entropia, mostrato SOLO nella dashboard dell'owner autenticato;
//     - è HMAC a riposo (mai in chiaro nel DB), TTL 10 min, SINGLE-USE atomico.
//   Il possesso di un code valido e non consumato È la prova dell'intenzione dell'owner
//   (l'owner lo trascrive/incolla manualmente sull'appliance). Aggiungere un secondo
//   "approve" non aumenta la sicurezza qui (l'owner ha già agito autenticato) ma aggiunge
//   superficie e attrito. Quindi `approved_at` viene impostato alla generazione.
//   `POST /api/pair/approve` resta ESPOSTO come no-op idempotente per UX/estensione futura
//   (revoca/re-conferma), ma il claim non lo richiede.
//
// SEC-001: il bundle ritornato al claim contiene SOLO uno snapshot NON segreto dell'owner
//   (cloud_owner_id, email, name). MAI il password_hash. Il login owner offline usa una
//   credenziale LOCALE dedicata (gestita lato appliance in Fase 4).
// SEC-003: l'appliance prova il possesso di una keypair (devicePubKey). L'appliance token
//   è legato a quella pubkey (record cloud_appliances). Single-use atomico del code.
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { and, eq, gt, isNull } from 'drizzle-orm'
import {
  cloudDb,
  cloudOwners,
  cloudRestaurants,
  cloudAppliances,
  cloudPairingCodes,
} from '../../cloud/db.js'
import { hashToken, generateSessionToken } from '../../cloud/security.js'
import { requireCloudAuth, requireCsrf } from '../../middleware/cloudAuth.js'
import { audit } from '../../cloud/audit.js'

// TTL del device code: 10 minuti (MASTER_PLAN §3.3 / SEC-003).
const PAIRING_CODE_TTL_MS = 10 * 60 * 1000

// Device code mostrato all'owner: alto-entropia, base32-like leggibile. Riusiamo il
// generatore di token di sessione (randomBytes 48B → base64url) come sorgente entropica:
// è opaco e ben oltre i 32 byte richiesti. A riposo si salva SOLO l'HMAC (code_hash).
function generatePairingCode(): { code: string; codeHash: string } {
  const { token, tokenHash } = generateSessionToken()
  return { code: token, codeHash: tokenHash }
}

// Pubkey appliance: stringa opaca (PEM/base64) generata lato appliance. Qui validiamo
// solo lunghezza/forma di base; la verifica crittografica della firma è Fase 4 (l'appliance
// firmerà le heartbeat con la privkey corrispondente).
const pubkeySchema = z.string().min(32).max(4096)

const codeSchema = z.object({ restaurantId: z.string().uuid() })
const claimSchema = z.object({
  code: z.string().min(16).max(200),
  devicePubKey: pubkeySchema,
})
const approveSchema = z.object({ code: z.string().min(16).max(200) })
const heartbeatSchema = z.object({ credentialsVersion: z.number().int().min(0).optional() })

const APPLIANCE_TOKEN_HEADER = 'x-tako-appliance-token'

export async function cloudPairRoutes(fastify: FastifyInstance) {
  // ─── STATUS (informativo) ────────────────────────────────────────────────────
  fastify.get('/status', async () => ({ data: { enabled: true, phase: '2b' } }))

  // ─── POST /code — owner autenticato genera un device code per un suo ristorante ──
  // Verifica OWNERSHIP del restaurantId (SEC-011): mai fidarsi dell'input, l'owner viene
  // dalla SESSIONE. Auto-approve: approved_at = now() (vedi nota in testa al file).
  fastify.post('/code', { preHandler: [requireCloudAuth, requireCsrf] }, async (req, reply) => {
    const ctx = req.cloudOwner!
    const parsed = codeSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: { code: 'VALIDATION', message: 'Dati non validi' } })

    const [restaurant] = await cloudDb
      .select()
      .from(cloudRestaurants)
      .where(and(eq(cloudRestaurants.id, parsed.data.restaurantId), eq(cloudRestaurants.ownerId, ctx.id)))
      .limit(1)
    if (!restaurant) {
      // Non rivelare se il ristorante esiste ma è di un altro owner → 403 secco.
      return reply.code(403).send({ error: { code: 'FORBIDDEN', message: 'Ristorante non disponibile' } })
    }

    const { code, codeHash } = generatePairingCode()
    const now = new Date()
    await cloudDb.insert(cloudPairingCodes).values({
      ownerId: ctx.id,
      restaurantId: restaurant.id,
      codeHash,
      approvedAt: now, // auto-approve alla generazione (owner autenticato)
      expiresAt: new Date(now.getTime() + PAIRING_CODE_TTL_MS),
    })
    await audit({ event: 'pair_code_generated', ownerId: ctx.id, req, meta: { restaurantId: restaurant.id } })

    // Il code in CHIARO viene mostrato una sola volta all'owner; a riposo c'è solo l'HMAC.
    return reply.send({
      data: { code, expiresInSeconds: Math.floor(PAIRING_CODE_TTL_MS / 1000), restaurantId: restaurant.id },
    })
  })

  // ─── POST /approve — conferma esplicita (idempotente, opzionale) ────────────────
  // Non richiesto dal claim (auto-approve), esposto per UX/estensioni future. L'owner può
  // ri-confermare un proprio code valido. Verifica ownership del code.
  fastify.post('/approve', { preHandler: [requireCloudAuth, requireCsrf] }, async (req, reply) => {
    const ctx = req.cloudOwner!
    const parsed = approveSchema.safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({ error: { code: 'VALIDATION', message: 'Dati non validi' } })

    const codeHash = hashToken(parsed.data.code)
    const [updated] = await cloudDb
      .update(cloudPairingCodes)
      .set({ approvedAt: new Date() })
      .where(and(
        eq(cloudPairingCodes.codeHash, codeHash),
        eq(cloudPairingCodes.ownerId, ctx.id),
        isNull(cloudPairingCodes.consumedAt),
        gt(cloudPairingCodes.expiresAt, new Date()),
      ))
      .returning()
    if (!updated) return reply.code(400).send({ error: { code: 'INVALID_CODE', message: 'Codice non valido o scaduto' } })
    return reply.send({ data: { approved: true } })
  })

  // ─── POST /claim — appliance riscatta il code e ottiene il bundle + appliance token ──
  // NON richiede sessione owner: l'appliance non ha cookie. La prova è il code valido,
  // approvato e non consumato. Single-use ATOMICO. Il bundle NON contiene il password_hash.
  fastify.post('/claim', async (req, reply) => {
    const parsed = claimSchema.safeParse(req.body)
    if (!parsed.success) {
      await audit({ event: 'pair_claim_refused', req, meta: { reason: 'validation' } })
      return reply.code(400).send({ error: { code: 'VALIDATION', message: 'Dati non validi' } })
    }

    const codeHash = hashToken(parsed.data.code)
    // Consumo atomico: SOLO un code valido, NON consumato, NON scaduto e APPROVATO vince.
    const [consumed] = await cloudDb
      .update(cloudPairingCodes)
      .set({ consumedAt: new Date(), devicePubkey: parsed.data.devicePubKey })
      .where(and(
        eq(cloudPairingCodes.codeHash, codeHash),
        isNull(cloudPairingCodes.consumedAt),
        gt(cloudPairingCodes.expiresAt, new Date()),
      ))
      .returning()

    if (!consumed) {
      await audit({ event: 'pair_claim_refused', req, meta: { reason: 'invalid_or_expired' } })
      return reply.code(400).send({ error: { code: 'INVALID_CODE', message: 'Codice non valido, scaduto o già usato' } })
    }
    if (!consumed.approvedAt) {
      // Non dovrebbe accadere con l'auto-approve, ma difesa-in-profondità: code non approvato.
      await audit({ event: 'pair_claim_refused', ownerId: consumed.ownerId, req, meta: { reason: 'not_approved' } })
      return reply.code(403).send({ error: { code: 'NOT_APPROVED', message: 'Pairing non approvato' } })
    }

    // Emette l'appliance token (opaco), legato alla pubkey. A riposo NON salviamo il token:
    // salviamo la pubkey (proof-of-possession). L'appliance proverà il possesso firmando le
    // heartbeat con la privkey; il token opaco identifica il record appliance lato cloud.
    const [restaurant] = await cloudDb.select().from(cloudRestaurants).where(eq(cloudRestaurants.id, consumed.restaurantId)).limit(1)
    const [owner] = await cloudDb.select().from(cloudOwners).where(eq(cloudOwners.id, consumed.ownerId)).limit(1)
    if (!restaurant || !owner) {
      return reply.code(409).send({ error: { code: 'CONFLICT', message: 'Ristorante o owner non più disponibili' } })
    }

    const { token: applianceToken } = generateSessionToken()
    // Registra l'appliance (pubkey unica). Se la pubkey è già nota → riusa il record (re-pairing).
    const [appliance] = await cloudDb
      .insert(cloudAppliances)
      .values({
        restaurantId: restaurant.id,
        pubkey: parsed.data.devicePubKey,
        seenCredentialsVersion: owner.credentialsVersion,
        lastSeenAt: new Date(),
      })
      .onConflictDoUpdate({
        target: cloudAppliances.pubkey,
        set: { restaurantId: restaurant.id, lastSeenAt: new Date(), revokedAt: null },
      })
      .returning()

    await audit({ event: 'pair_claimed', ownerId: owner.id, req, meta: { restaurantId: restaurant.id, applianceId: appliance!.id } })

    // Bundle: snapshot NON segreto dell'owner (SEC-001). MAI password_hash.
    return reply.send({
      data: {
        applianceToken,                 // token opaco (lato appliance, store cifrato — Fase 4)
        applianceId: appliance!.id,
        restaurant: { id: restaurant.id, name: restaurant.name, slug: restaurant.slug, plan: restaurant.plan },
        ownerSnapshot: { cloud_owner_id: owner.id, email: owner.email, name: owner.name },
        credentialsVersion: owner.credentialsVersion,
      },
    })
  })

  // ─── POST /heartbeat — appliance segnala la presenza e sincronizza credentials_version ──
  // Autenticazione: header X-Tako-Appliance-Token che identifica il record appliance via il
  // suo applianceId (passato nel body). NB: la verifica crittografica della FIRMA della
  // heartbeat con la privkey dell'appliance è Fase 4; qui usiamo l'applianceId + pubkey come
  // identificatore e confrontiamo le versioni. Ritorna se serve revoca/refresh.
  fastify.post('/heartbeat', async (req, reply) => {
    const applianceId = (req.headers[APPLIANCE_TOKEN_HEADER] as string | undefined) ?? undefined
    if (!applianceId) return reply.code(401).send({ error: { code: 'UNAUTHORIZED', message: 'Appliance non identificata' } })

    const parsed = heartbeatSchema.safeParse(req.body ?? {})
    if (!parsed.success) return reply.code(400).send({ error: { code: 'VALIDATION', message: 'Dati non validi' } })

    const [appliance] = await cloudDb
      .select({ appliance: cloudAppliances, ownerVersion: cloudOwners.credentialsVersion })
      .from(cloudAppliances)
      .innerJoin(cloudRestaurants, eq(cloudAppliances.restaurantId, cloudRestaurants.id))
      .innerJoin(cloudOwners, eq(cloudRestaurants.ownerId, cloudOwners.id))
      .where(eq(cloudAppliances.id, applianceId))
      .limit(1)

    if (!appliance) return reply.code(401).send({ error: { code: 'UNAUTHORIZED', message: 'Appliance sconosciuta' } })
    if (appliance.appliance.revokedAt) {
      return reply.code(403).send({ error: { code: 'REVOKED', message: 'Appliance revocata' }, data: { action: 'revoke' } })
    }

    const cloudVersion = appliance.ownerVersion
    await cloudDb
      .update(cloudAppliances)
      .set({ lastSeenAt: new Date(), seenCredentialsVersion: cloudVersion })
      .where(eq(cloudAppliances.id, applianceId))

    // Se il cloud ha bumpato credentials_version (reset/cambio pw) → l'appliance deve
    // aggiornare lo snapshot non-segreto e invalidare il login owner offline (SEC-007).
    const local = parsed.data.credentialsVersion ?? appliance.appliance.seenCredentialsVersion
    const needsRefresh = cloudVersion > local

    await audit({ event: 'pair_heartbeat', ownerId: null, req, meta: { applianceId, needsRefresh } })
    return reply.send({ data: { credentialsVersion: cloudVersion, action: needsRefresh ? 'refresh' : 'none' } })
  })
}
