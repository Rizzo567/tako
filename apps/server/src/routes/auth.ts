import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { nanoid } from 'nanoid'
import { createHmac, randomBytes } from 'node:crypto'
import { db, users, sessions, restaurants, menus, deviceEnrollCodes } from '@tako/db'
import { eq, and, sql, isNotNull, isNull, gt, desc, inArray } from 'drizzle-orm'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { SESSION_COOKIE, authCookieOptions, STAFF_SESSION_MAX_AGE, MOBILE_SESSION_MAX_AGE } from '../lib/cookies.js'
import { lanBaseUrl } from '../lib/network.js'
import { qrWithOctopus } from '../lib/qr-octopus.js'
import { emailVerificationEnabled, cloudRegisterOwner, cloudLoginProbe, cloudResendVerification } from '../lib/cloud-verify.js'

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
})

const registerSchema = z.object({
  restaurantName: z.string().min(2),
  restaurantSlug: z.string().min(2).regex(/^[a-z0-9-]+$/),
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
  // Opt-in newsletter: inoltrato al cloud, iscrizione Resend Audience alla verifica.
  newsletter: z.boolean().optional(),
})

// In-memory brute force tracker (per IP)
const loginAttempts = new Map<string, { count: number; firstAttempt: number }>()
const MAX_ATTEMPTS = 5
const LOCKOUT_MS = 15 * 60 * 1000 // 15 minuti
const MAX_TRACKED = 5000 // bound memoria: evita crescita illimitata della mappa

// La chiave è ip+email: un dito storto su una mail non blocca tutto lo staff
// dietro lo stesso IP (NAT del ristorante), e si limita comunque il credential stuffing.
function bruteKey(ip: string, email: string) { return `${ip}::${email.toLowerCase()}` }

function checkBruteForce(key: string, maxAttempts: number = MAX_ATTEMPTS): boolean {
  const now = Date.now()
  const record = loginAttempts.get(key)
  if (!record) return true
  if (now - record.firstAttempt > LOCKOUT_MS) { loginAttempts.delete(key); return true }
  return record.count < maxAttempts
}

// Soglia per-ristorante del PIN-login: più alta della soglia per-IP perché un
// turno con molto personale produce diversi PIN errati legittimi; serve solo a
// fermare un attacco LAN che ruota gli IP, non a bloccare lo staff.
const PIN_RESTAURANT_MAX_ATTEMPTS = 10

// Cap per-IP indipendente dall'email su /login: il contatore ip+email blocca il
// brute-force su un singolo account, ma non ferma il password spraying (5 password
// su N email diverse dallo stesso IP). Soglia alta per non bloccare lo staff dietro
// NAT del ristorante (più utenti, stesso IP).
const LOGIN_IP_MAX_ATTEMPTS = 30

function recordFailedLogin(key: string) {
  const now = Date.now()
  // Pulizia opportunistica delle voci scadute quando la mappa cresce troppo.
  if (loginAttempts.size > MAX_TRACKED) {
    for (const [k, v] of loginAttempts) if (now - v.firstAttempt > LOCKOUT_MS) loginAttempts.delete(k)
  }
  const record = loginAttempts.get(key)
  if (!record || now - record.firstAttempt > LOCKOUT_MS) {
    loginAttempts.set(key, { count: 1, firstAttempt: now })
  } else {
    record.count++
  }
}

// ─────────────── Arruolamento del telefono (app owner — piano F2.1) ───────────────
//
// FLUSSO. L'owner, dalla dashboard `/staff` (quindi già autenticato e IN LAN), apre
// «Dispositivi → Collega telefono» e vede un QR. Il telefono lo scansiona sulla stessa
// rete e ottiene un Bearer da 30 giorni. Il possesso della dashboard autenticata in LAN
// È la prova dell'intenzione: stesso ragionamento del device-code cloud di
// routes/cloud/pair.ts, dove il code è auto-approvato alla generazione.
//
// La disciplina del codice è copiata da lì, punto per punto:
//   - alta entropia (32 byte random, base64url);
//   - HMAC A RIPOSO: nel DB non c'è mai il codice in chiaro, solo l'HMAC;
//   - TTL breve (5 minuti: il QR è sullo schermo, non serve di più);
//   - SINGLE-USE ATOMICO: il consumo è una UPDATE ... WHERE consumed_at IS NULL, quindi
//     due telefoni che scansionano lo stesso QR non ottengono mai due sessioni;
//   - lockout PER-CODICE, indipendente dall'IP (un attaccante che ruota IP viene fermato).
const ENROLL_CODE_TTL_MS = 5 * 60 * 1000
const ENROLL_MAX_ATTEMPTS = 5
const ENROLL_LOCKOUT_MS = ENROLL_CODE_TTL_MS
const ENROLL_MAX_TRACKED = 2000

// HMAC del codice con il segreto del server. Il cloud usa TOKEN_PEPPER (env del deploy);
// l'appliance ha già JWT_SECRET, persistito in ~/.tako/jwt-secret da bootstrap.ts e
// obbligatorio all'avvio (index.ts). Prefisso di dominio: lo stesso segreto firma anche
// i JWT del tavolo, e due usi diversi non devono mai produrre lo stesso digest.
function hashEnrollCode(code: string): string {
  const secret = process.env['JWT_SECRET'] ?? ''
  return createHmac('sha256', secret).update(`device-enroll:${code}`).digest('hex')
}

// Lockout per-codice in-memory: l'appliance è un processo singolo (niente Redis come
// nel control-plane cloud), quindi una Map basta e ha lo stesso comportamento osservabile.
const enrollAttempts = new Map<string, { count: number; firstAttempt: number }>()

function enrollLockedOut(codeHash: string): boolean {
  const rec = enrollAttempts.get(codeHash)
  if (!rec) return false
  if (Date.now() - rec.firstAttempt > ENROLL_LOCKOUT_MS) { enrollAttempts.delete(codeHash); return false }
  return rec.count >= ENROLL_MAX_ATTEMPTS
}

function recordEnrollFailure(codeHash: string): void {
  const now = Date.now()
  if (enrollAttempts.size > ENROLL_MAX_TRACKED) {
    for (const [k, v] of enrollAttempts) if (now - v.firstAttempt > ENROLL_LOCKOUT_MS) enrollAttempts.delete(k)
  }
  const rec = enrollAttempts.get(codeHash)
  if (!rec || now - rec.firstAttempt > ENROLL_LOCKOUT_MS) enrollAttempts.set(codeHash, { count: 1, firstAttempt: now })
  else rec.count++
}

export async function authRoutes(fastify: FastifyInstance) {
  // Il controllo brute-force è applicato direttamente in /login (per ip+email),
  // dove l'email è disponibile. Vedi checkBruteForce/recordFailedLogin sopra.

  // Register new restaurant + owner. Rate-limit dedicato più stretto: ferma
  // l'amplificazione bcrypt e la creazione anonima ripetuta di tenant.
  fastify.post('/register', { config: { rateLimit: { max: 3, timeWindow: 3600000 } } }, async (req, reply) => {
    // Provisioning guard. L'endpoint è anonimo e raggiungibile in LAN (host 0.0.0.0):
    // dopo il setup dell'appliance va chiuso per impedire creazione arbitraria di tenant.
    // 1) gate esplicito via env (impostato dopo il primo setup)
    if (process.env['TAKO_DISABLE_REGISTRATION'] === '1') {
      return reply.code(403).send({ error: { code: 'REGISTRATION_DISABLED', message: 'Registrazione non disponibile.' } })
    }
    // 2) auto-chiusura dopo il primo tenant (appliance mono-ristorante), salvo modalità multi-tenant cloud
    if (process.env['TAKO_MULTI_TENANT'] !== '1') {
      const countRows = await db.select({ count: sql<number>`count(*)::int` }).from(restaurants)
      if ((countRows[0]?.count ?? 0) > 0) return reply.code(403).send({ error: { code: 'ALREADY_PROVISIONED', message: 'Appliance già configurata.' } })
    }

    const body = registerSchema.safeParse(req.body)
    if (!body.success) return reply.code(400).send({ error: { code: 'VALIDATION', message: body.error.message } })

    const { restaurantName, restaurantSlug, name, email, password, newsletter } = body.data

    // Verifica email OBBLIGATORIA (decisione 2026-07-10), attiva solo con CLOUD_BASE_URL:
    // PRIMA della transazione locale registriamo l'owner sul cloud, che invia l'email di
    // verifica via Resend. Se il cloud è giù NON creiamo il tenant (la registrazione
    // sull'appliance è one-shot: un tenant senza email di verifica resterebbe murato).
    const verifyGate = emailVerificationEnabled()
    if (verifyGate) {
      const sync = await cloudRegisterOwner({ email: email.toLowerCase(), password, name, newsletter })
      if (sync === 'unreachable') {
        return reply.code(503).send({ error: { code: 'VERIFY_UNAVAILABLE', message: 'Verifica email non disponibile: controlla la connessione internet e riprova.' } })
      }
      if (sync === 'error') {
        return reply.code(400).send({ error: { code: 'CLOUD_REJECTED', message: 'Registrazione rifiutata: usa una password più lunga (min 10 caratteri).' } })
      }
    }

    try {
      // Check slug unique
      const existing = await db.select().from(restaurants).where(eq(restaurants.slug, restaurantSlug)).limit(1)
      if (existing.length) return reply.code(409).send({ error: { code: 'CONFLICT', message: 'Slug già in uso. Scegli un altro.' } })

      // Check email unique
      const existingUser = await db.select().from(users).where(eq(users.email, email)).limit(1)
      if (existingUser.length) return reply.code(409).send({ error: { code: 'EMAIL_TAKEN', message: 'Email già registrata.' } })

      const passwordHash = await bcrypt.hash(password, 12)

      const token = nanoid(64)
      // Sessione DB allineata alla maxAge del cookie (7g): evita un token server-side
      // valido 30g mentre il cookie scade a 7g (finestra di replay).
      const expiresAt = new Date(Date.now() + STAFF_SESSION_MAX_AGE * 1000)

      // Registrazione atomica: restaurant + menu day-1 + owner + sessione in UNA
      // transazione. Senza, un errore a metà lascerebbe un ristorante orfano; con
      // l'auto-chiusura (count>0 → ALREADY_PROVISIONED) l'appliance si bloccherebbe
      // (registrazione disabilitata ma nessun owner per il login).
      const { restaurant, user } = await db.transaction(async (tx) => {
        const [restaurant] = await tx.insert(restaurants).values({
          name: restaurantName,
          slug: restaurantSlug,
          plan: 'free',
        }).returning()

        // Menu day-1: crea subito un menu di default così la SPA (loadMenu) trova un
        // menu esistente al primo accesso e le azioni menu non vanno su /menus/undefined/...
        // Campi presi da POST /api/menus (menu.ts): restaurantId + name; type ha default 'main'.
        await tx.insert(menus).values({
          restaurantId: restaurant!.id,
          name: 'Menu',
          type: 'main',
        })

        const [user] = await tx.insert(users).values({
          restaurantId: restaurant!.id,
          name,
          email,
          passwordHash,
          role: 'owner',
        }).returning()

        // Col gate attivo NIENTE sessione: si entra solo dal login, dopo la verifica.
        if (!verifyGate) await tx.insert(sessions).values({ userId: user!.id, token, expiresAt })

        return { restaurant, user }
      })

      if (verifyGate) {
        return reply.code(201).send({
          data: {
            pendingVerification: true,
            email: user!.email,
            message: 'Ti abbiamo inviato un\'email di verifica: conferma e poi accedi.',
          },
        })
      }

      reply.setCookie(SESSION_COOKIE, token, authCookieOptions(STAFF_SESSION_MAX_AGE))
      return reply.code(201).send({
        data: {
          user: { id: user!.id, name: user!.name, email: user!.email, role: user!.role },
          restaurant: { id: restaurant!.id, name: restaurant!.name, slug: restaurant!.slug },
        },
      })
    } catch (err: any) {
      fastify.log.error({ err }, 'Registration error')
      // Postgres unique violation
      if (err?.code === '23505') {
        if (err.constraint?.includes('slug')) return reply.code(409).send({ error: { code: 'CONFLICT', message: 'Slug già in uso. Scegli un altro.' } })
        if (err.constraint?.includes('email')) return reply.code(409).send({ error: { code: 'EMAIL_TAKEN', message: 'Email già registrata.' } })
      }
      return reply.code(500).send({ error: { code: 'SERVER_ERROR', message: 'Errore interno. Riprova tra qualche secondo.' } })
    }
  })

  // Login
  fastify.post('/login', async (req, reply) => {
    const body = loginSchema.safeParse(req.body)
    if (!body.success) return reply.code(400).send({ error: { code: 'VALIDATION', message: body.error.message } })

    // Brute-force per (ip, email): blocca dopo 5 tentativi falliti in 15 min.
    // In più un cap per-IP (ip aggregato su tutte le email) ferma il password
    // spraying da un singolo IP senza bloccare lo staff legittimo dietro NAT.
    const key = bruteKey(req.ip, body.data.email)
    const ipKey = `login-ip::${req.ip}`
    if (!checkBruteForce(key) || !checkBruteForce(ipKey, LOGIN_IP_MAX_ATTEMPTS)) {
      return reply.code(429).send({ error: { code: 'BRUTE_FORCE', message: 'Troppi tentativi. Riprova tra 15 minuti.' } })
    }

    const [user] = await db.select().from(users).where(eq(users.email, body.data.email.toLowerCase())).limit(1)
    // Un utente è autenticabile se ha una password locale classica (staff/owner storico)
    // OPPURE, per l'owner sincronizzato dal cloud, una credenziale owner LOCALE dedicata
    // (local_owner_secret_hash) impostata al pairing per l'accesso OFFLINE (SEC-001).
    // Il login offline non richiede mai il password_hash cloud (che non è sul box).
    if (!user || (!user.passwordHash && !user.localOwnerSecretHash)) {
      recordFailedLogin(key)
      recordFailedLogin(ipKey)
      return reply.code(401).send({ error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' } })
    }

    // Confronto contro entrambe le credenziali disponibili. L'owner cloud-synced può
    // avere SOLO local_owner_secret_hash (nessun passwordHash classico).
    const matchClassic = user.passwordHash ? await bcrypt.compare(body.data.password, user.passwordHash) : false
    const matchLocalOwner = user.localOwnerSecretHash ? await bcrypt.compare(body.data.password, user.localOwnerSecretHash) : false
    const valid = matchClassic || matchLocalOwner
    if (!valid) {
      recordFailedLogin(key)
      recordFailedLogin(ipKey)
      return reply.code(401).send({ error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' } })
    }

    // Login riuscito: azzera il contatore per questa coppia. NON azzeriamo ipKey:
    // l'IP aggrega email diverse dietro NAT, quindi lasciamo scadere la finestra
    // naturalmente (15 min) anziché ricaricare il budget di uno spraying in corso.
    loginAttempts.delete(key)

    // Gate verifica email (solo owner, solo registrazioni post-gate: gli owner storici
    // sono grandfathered dalla migrazione 0010, i pairati dal cloud arrivano già
    // verificati da setup.ts). Il probe usa le credenziali appena validate — mai salvate.
    if (user.role === 'owner' && !user.emailVerified && emailVerificationEnabled()) {
      const probe = await cloudLoginProbe(user.email, body.data.password)
      if (probe === 'verified') {
        await db.update(users).set({ emailVerified: true }).where(eq(users.id, user.id))
      } else if (probe === 'unreachable') {
        return reply.code(503).send({ error: { code: 'VERIFY_UNAVAILABLE', message: 'Impossibile controllare la verifica email (nessuna connessione). Riprova.' } })
      } else {
        return reply.code(403).send({ error: { code: 'EMAIL_NOT_VERIFIED', message: 'Conferma la tua email: controlla la posta (anche lo spam).' } })
      }
    }

    const token = nanoid(64)
    // Sessione DB allineata alla maxAge del cookie (7g), vedi /register.
    const expiresAt = new Date(Date.now() + STAFF_SESSION_MAX_AGE * 1000)
    await db.insert(sessions).values({ userId: user.id, token, expiresAt })

    const [restaurant] = await db.select().from(restaurants).where(eq(restaurants.id, user.restaurantId!)).limit(1)

    reply.setCookie(SESSION_COOKIE, token, authCookieOptions(STAFF_SESSION_MAX_AGE))
    return { data: { user: { id: user.id, name: user.name, email: user.email, role: user.role }, restaurant } }
  })

  // Reinvia l'email di verifica (proxy del resend cloud). Risposta SEMPRE generica
  // (anti-enumeration, come sul cloud). Rate-limit stretto: è un endpoint anonimo.
  fastify.post('/resend-verification', { config: { rateLimit: { max: 3, timeWindow: 3600000 } } }, async (req) => {
    const body = z.object({ email: z.string().email() }).safeParse(req.body)
    if (body.success && emailVerificationEnabled()) {
      await cloudResendVerification(body.data.email.toLowerCase())
    }
    return { data: { message: 'Se l\'indirizzo è registrato, riceverai un\'email a breve.' } }
  })

  // PIN login (for shared tablets)
  fastify.post('/pin-login', async (req, reply) => {
    const pinLoginSchema = z.object({
      restaurantId: z.string().uuid(),
      // Identità dell'utente OBBLIGATORIA: la UI del tablet condiviso seleziona il
      // dipendente prima del PIN. Così ogni tentativo è 1-PIN-contro-1-utente
      // (prob. 1/10^4) e non 1-contro-N (k-anonymity che amplificava il brute-force).
      userId: z.string().uuid(),
      pin: z.string().length(4).regex(/^\d{4}$/),
    })
    const body = pinLoginSchema.safeParse(req.body)
    if (!body.success) return reply.code(400).send({ error: { code: 'VALIDATION', message: body.error.message } })
    const { restaurantId, userId, pin } = body.data

    // Brute-force PIN: chiave per-IP (blocca il singolo device) + chiave per-UTENTE
    // (il cap protegge ogni singolo PIN senza che un attaccante diluisca i tentativi
    // su N staff né che lo staff legittimo si DoS a vicenda). Solo i tentativi
    // FALLITI contano e il successo azzera: lo staff col PIN giusto non viene bloccato.
    const ipKey = `pin::${req.ip}::${restaurantId}`
    const ridKey = `pin::USER::${restaurantId}::${userId}`
    if (!checkBruteForce(ipKey) || !checkBruteForce(ridKey, PIN_RESTAURANT_MAX_ATTEMPTS)) {
      return reply.code(429).send({ error: { code: 'BRUTE_FORCE', message: 'Troppi tentativi. Riprova tra 15 minuti.' } })
    }

    // Un solo utente: il PIN è confrontato esclusivamente contro l'utente selezionato.
    const [user] = await db.select().from(users)
      .where(and(eq(users.restaurantId, restaurantId), eq(users.id, userId), eq(users.active, true)))
      .limit(1)
    // Solo PIN hashati con bcrypt: niente più fallback plaintext legacy.
    const ok = !!user?.pin && user.pin.startsWith('$2') && await bcrypt.compare(pin, user.pin)
    if (!ok || !user) {
      recordFailedLogin(ipKey)
      recordFailedLogin(ridKey)
      return reply.code(401).send({ error: { code: 'INVALID_PIN', message: 'Invalid PIN' } })
    }
    // Login riuscito: azzera i contatori brute-force per questo (ip, utente).
    loginAttempts.delete(ipKey)
    loginAttempts.delete(ridKey)

    const token = nanoid(32)
    const expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000) // 12h for PIN sessions
    await db.insert(sessions).values({ userId: user.id, token, expiresAt })

    reply.setCookie(SESSION_COOKIE, token, authCookieOptions(12 * 60 * 60))
    return { data: { user: { id: user.id, name: user.name, role: user.role } } }
  })

  // Get current user
  fastify.get('/me', { preHandler: requireAuth }, async (req) => {
    return { data: req.user }
  })

  // Roster per il login PIN del tablet condiviso (pubblico, no auth): espone SOLO
  // id+nome+ruolo dei membri attivi con PIN impostato — nessuna email/hash/pin.
  // Il brute-force resta gestito da /pin-login (per-IP + per-utente).
  fastify.get('/pin-roster', async (req, reply) => {
    // Solo appliance mono-ristorante (login-tablet in LAN). In multi-tenant l'endpoint
    // pubblico permetterebbe di enumerare nomi+userId+ruolo dello staff conoscendo un
    // restaurantId → disabilitato (usare un flusso autenticato).
    if (process.env['TAKO_MULTI_TENANT'] === '1') {
      return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Non disponibile' } })
    }
    const q = req.query as { restaurantId?: string }
    let restaurantId = q.restaurantId
    if (!restaurantId) {
      // Appliance mono-ristorante: risolvi l'unico ristorante. In multi-tenant serve ?restaurantId.
      const rows = await db.select({ id: restaurants.id }).from(restaurants).limit(2)
      if (rows.length !== 1) return reply.code(404).send({ error: { code: 'NEEDS_RESTAURANT', message: 'restaurantId richiesto' } })
      restaurantId = rows[0]!.id
    }
    const [rest] = await db.select({ id: restaurants.id, name: restaurants.name }).from(restaurants).where(eq(restaurants.id, restaurantId)).limit(1)
    if (!rest) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Ristorante non trovato' } })
    const members = await db.select({ id: users.id, name: users.name, role: users.role }).from(users)
      .where(and(eq(users.restaurantId, restaurantId), eq(users.active, true), isNotNull(users.pin)))
    return { data: { restaurantId, restaurant: rest, members } }
  })

  // ─── POST /device/enroll-code — l'owner genera il QR per collegare un telefono ───
  // requireRole('owner'): non è un'azione da cameriere. Il codice in CHIARO esce da qui
  // una volta sola (dentro il QR mostrato sullo schermo dell'owner); a riposo c'è l'HMAC.
  fastify.post('/device/enroll-code', { preHandler: requireRole('owner') }, async (req, reply) => {
    const code = randomBytes(32).toString('base64url')
    const codeHash = hashEnrollCode(code)
    const expiresAt = new Date(Date.now() + ENROLL_CODE_TTL_MS)

    await db.insert(deviceEnrollCodes).values({
      restaurantId: req.user!.restaurantId,
      userId: req.user!.id,
      codeHash,
      expiresAt,
    })

    // Pulizia opportunistica: i codici scaduti non servono più a nulla e la tabella
    // non deve crescere per sempre (un QR generato e mai usato è la norma, non l'eccezione).
    try {
      await db.delete(deviceEnrollCodes).where(sql`${deviceEnrollCodes.expiresAt} < now() - interval '1 day'`)
    } catch { /* best-effort */ }

    // Il QR porta il telefono direttamente sull'app owner in LAN, col codice nel FRAGMENT:
    // il fragment non viene mai inviato al server né finisce nei log di accesso, e l'app lo
    // consuma subito ripulendo la barra degli indirizzi.
    const enrollUrl = `${lanBaseUrl()}/owner/#enroll=${code}`
    let qrDataUrl: string | null = null
    try {
      qrDataUrl = await qrWithOctopus(enrollUrl, 360)
    } catch (err) {
      // Il QR è una comodità: se il rendering fallisce restano URL e codice, che
      // l'owner può digitare a mano (ripiego previsto dall'Exit del piano F2.1).
      req.log.warn({ err }, 'device enroll: QR non generato')
    }

    return reply.send({
      data: { code, enrollUrl, qrDataUrl, expiresInSeconds: Math.floor(ENROLL_CODE_TTL_MS / 1000) },
    })
  })

  // ─── POST /device/enroll — il telefono riscatta il codice (ANONIMO) ───────────────
  // Non richiede sessione: il telefono non ne ha ancora una. La prova è il codice valido,
  // non scaduto e non consumato. Rate-limit di route (il globale è per-IP e generoso) +
  // lockout per-codice: 5 tentativi falliti bruciano quel codice, non l'appliance.
  fastify.post('/device/enroll', { config: { rateLimit: { max: 10, timeWindow: 60000 } } }, async (req, reply) => {
    const schema = z.object({
      code: z.string().min(16).max(200),
      deviceName: z.string().max(60).optional(),
      platform: z.string().max(40).optional(),
    })
    const body = schema.safeParse(req.body)
    if (!body.success) return reply.code(400).send({ error: { code: 'VALIDATION', message: 'Dati non validi' } })

    const codeHash = hashEnrollCode(body.data.code)
    if (enrollLockedOut(codeHash)) {
      return reply.code(429).send({ error: { code: 'TOO_MANY_ATTEMPTS', message: 'Troppi tentativi su questo codice. Genera un nuovo QR.' } })
    }

    // Consumo ATOMICO: vince una sola richiesta. Un secondo telefono (o lo stesso QR
    // scansionato due volte) trova consumed_at valorizzato e riceve 400.
    const [consumed] = await db
      .update(deviceEnrollCodes)
      .set({ consumedAt: new Date() })
      .where(and(
        eq(deviceEnrollCodes.codeHash, codeHash),
        isNull(deviceEnrollCodes.consumedAt),
        gt(deviceEnrollCodes.expiresAt, new Date()),
      ))
      .returning()

    if (!consumed) {
      recordEnrollFailure(codeHash)
      return reply.code(400).send({ error: { code: 'INVALID_CODE', message: 'Codice non valido, scaduto o già usato.' } })
    }

    // L'utente deve esistere ed essere ancora attivo: un owner disattivato fra la
    // generazione del QR e la scansione non deve poter arruolare un telefono.
    const [user] = await db.select().from(users)
      .where(and(eq(users.id, consumed.userId), eq(users.active, true))).limit(1)
    if (!user || user.restaurantId !== consumed.restaurantId) {
      return reply.code(403).send({ error: { code: 'FORBIDDEN', message: 'Utente non più disponibile.' } })
    }

    const token = nanoid(64)
    const expiresAt = new Date(Date.now() + MOBILE_SESSION_MAX_AGE * 1000)
    const [session] = await db.insert(sessions).values({
      userId: user.id,
      token,
      expiresAt,
      kind: 'mobile',
      deviceName: body.data.deviceName ?? 'Telefono',
      devicePlatform: body.data.platform ?? null,
      lastSeenAt: new Date(),
    }).returning()

    await db.update(deviceEnrollCodes).set({ sessionId: session!.id }).where(eq(deviceEnrollCodes.id, consumed.id))

    const [restaurant] = await db.select().from(restaurants).where(eq(restaurants.id, consumed.restaurantId)).limit(1)

    // NESSUN cookie: l'app owner autentica sempre col Bearer, che sopravvive al passaggio
    // fra l'origine LAN (http) e quella del tunnel (https). Vedi piano §3 D3.
    return reply.code(201).send({
      data: {
        token,
        expiresAt: expiresAt.toISOString(),
        deviceId: session!.id,
        user: { id: user.id, name: user.name, email: user.email, role: user.role },
        restaurant: restaurant ? { id: restaurant.id, name: restaurant.name, slug: restaurant.slug } : null,
      },
    })
  })

  // ─── GET /devices — i telefoni arruolati del ristorante ───────────────────────────
  // Owner-only e scoped al ristorante (anti cross-tenant come ogni altra route). Non
  // espone MAI il token: solo ciò che serve a riconoscere quale telefono revocare.
  fastify.get('/devices', { preHandler: requireRole('owner') }, async (req) => {
    const staff = await db.select({ id: users.id, name: users.name })
      .from(users).where(eq(users.restaurantId, req.user!.restaurantId))
    const staffIds = staff.map(s => s.id)
    if (!staffIds.length) return { data: [] }
    const rows = await db.select({
      id: sessions.id,
      userId: sessions.userId,
      deviceName: sessions.deviceName,
      devicePlatform: sessions.devicePlatform,
      createdAt: sessions.createdAt,
      lastSeenAt: sessions.lastSeenAt,
      expiresAt: sessions.expiresAt,
    }).from(sessions)
      .where(and(inArray(sessions.userId, staffIds), eq(sessions.kind, 'mobile'), gt(sessions.expiresAt, new Date())))
      .orderBy(desc(sessions.createdAt))
    const nameOf = new Map(staff.map(s => [s.id, s.name]))
    return { data: rows.map(r => ({ ...r, userName: nameOf.get(r.userId) ?? null })) }
  })

  // ─── DELETE /devices/:id — revoca immediata di un telefono ────────────────────────
  // La revoca è efficace ovunque e subito: requireAuth interroga `sessions` a ogni
  // richiesta, e il socket si rivalida entro 60 s (socket/handlers.ts).
  fastify.delete('/devices/:id', { preHandler: requireRole('owner') }, async (req, reply) => {
    const { id } = req.params as { id: string }
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Dispositivo non trovato' } })
    }
    const staff = await db.select({ id: users.id }).from(users).where(eq(users.restaurantId, req.user!.restaurantId))
    const staffIds = staff.map(s => s.id)
    if (!staffIds.length) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Dispositivo non trovato' } })
    const [deleted] = await db.delete(sessions)
      .where(and(eq(sessions.id, id), eq(sessions.kind, 'mobile'), inArray(sessions.userId, staffIds)))
      .returning({ id: sessions.id })
    if (!deleted) return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Dispositivo non trovato' } })
    return { data: { success: true } }
  })

  // Logout
  fastify.post('/logout', { preHandler: requireAuth }, async (req, reply) => {
    const token = req.cookies?.[SESSION_COOKIE] ?? req.headers.authorization?.replace('Bearer ', '')
    if (token) await db.delete(sessions).where(eq(sessions.token, token))
    reply.clearCookie(SESSION_COOKIE, { path: '/' })
    return { data: { success: true } }
  })
}
