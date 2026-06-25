// Login OAuth (Google + GitHub) per il CONTROL-PLANE cloud (MASTER_PLAN-cloud-auth §4/§5/§7).
//
// Sicurezza implementata:
//  - SEC-006: `state` generato/validato su questo dominio via il cookie temporaneo di
//    @fastify/oauth2 (HttpOnly, single-use, TTL corto). PKCE 'S256' su Google (GitHub non
//    lo supporta in modo affidabile). `redirect_uri` esatto costruito da OAUTH_BASE_URL (env fissa).
//  - SEC-002: link a un owner ESISTENTE solo se l'email del provider è verificata E l'owner
//    è già email_verified. Se l'owner esiste ma NON è verificato → NIENTE merge silenzioso
//    (anti pre-account-hijacking): si rifiuta e si invita a verificare/accedere. Altrimenti
//    si crea un nuovo owner (email_verified = vero solo se il provider lo conferma).
//  - SEC-005: redirect post-callback SOLO verso l'allowlist SITE_BASE_URL (no open-redirect).
//  - GitHub: l'email verificata si ottiene da /user/emails, usando SOLO { verified && primary }.
//
// Le route si montano solo se il provider è configurato (client id/secret presenti in env).
import type { FastifyInstance } from 'fastify'
import oauthPlugin from '@fastify/oauth2'
import { and, eq } from 'drizzle-orm'
import { cloudDb, cloudOwners, cloudOauthAccounts } from '../../cloud/db.js'
import { normalizeEmail } from '../../cloud/security.js'
import { issueCloudSession } from '../../cloud/session.js'
import { oauthProviderConfig, oauthCallbackUri, siteBaseUrl, safeRedirect, cookieMode } from '../../cloud/config.js'
import { audit } from '../../cloud/audit.js'

// Opzioni del cookie temporaneo di state/PKCE del plugin (SEC-006). In crosssite il
// callback rientra su un'altra origin → serve SameSite=None;Secure perché il cookie
// sopravviva al round-trip verso il provider. In samesite resta Lax (default sicuro).
function oauthStateCookie(): import('@fastify/cookie').CookieSerializeOptions {
  const crosssite = cookieMode() === 'crosssite'
  return {
    httpOnly: true,
    sameSite: crosssite ? 'none' : 'lax',
    secure: crosssite || process.env['COOKIE_SECURE'] === '1',
    path: '/',
  }
}

// Augmentazione tipi: i namespace OAuth2 vengono decorati su FastifyInstance.
declare module 'fastify' {
  interface FastifyInstance {
    googleOAuth2?: import('@fastify/oauth2').OAuth2Namespace
    githubOAuth2?: import('@fastify/oauth2').OAuth2Namespace
  }
}

type Provider = 'google' | 'github'

// Profilo normalizzato estratto dal provider: contiene SOLO ciò che ci serve.
interface ProviderProfile {
  providerUserId: string
  email: string | null
  emailVerified: boolean
}

const FETCH_TIMEOUT_MS = 10_000

async function fetchJson(url: string, accessToken: string): Promise<unknown> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
        'User-Agent': 'Tako-Cloud',
      },
      signal: controller.signal,
    })
    if (!res.ok) throw new Error(`provider ${url} → ${res.status}`)
    return res.json()
  } finally {
    clearTimeout(timer)
  }
}

// ─── Google: claim email_verified dall'userinfo OIDC ──────────────────────────
async function googleProfile(accessToken: string): Promise<ProviderProfile> {
  const u = (await fetchJson('https://openidconnect.googleapis.com/v1/userinfo', accessToken)) as {
    sub?: string
    email?: string
    email_verified?: boolean
  }
  if (!u.sub) throw new Error('Google userinfo: sub mancante')
  return {
    providerUserId: u.sub,
    email: u.email ? normalizeEmail(u.email) : null,
    emailVerified: u.email_verified === true,
  }
}

// ─── GitHub: id da /user, email VERIFICATA da /user/emails (verified && primary) ──
async function githubProfile(accessToken: string): Promise<ProviderProfile> {
  const u = (await fetchJson('https://api.github.com/user', accessToken)) as { id?: number }
  if (u.id == null) throw new Error('GitHub /user: id mancante')
  const emails = (await fetchJson('https://api.github.com/user/emails', accessToken)) as Array<{
    email?: string
    primary?: boolean
    verified?: boolean
  }>
  const primaryVerified = Array.isArray(emails)
    ? emails.find((e) => e.verified === true && e.primary === true && !!e.email)
    : undefined
  return {
    providerUserId: String(u.id),
    email: primaryVerified?.email ? normalizeEmail(primaryVerified.email) : null,
    // GitHub: consideriamo verificata SOLO l'email primaria verificata.
    emailVerified: !!primaryVerified,
  }
}

// Esito della risoluzione owner: o un owner valido per la sessione, o un rifiuto motivato.
type ResolveResult =
  | { kind: 'owner'; ownerId: string; credentialsVersion: number; created: boolean; linked: boolean }
  | { kind: 'refused'; reason: 'unverified_email' | 'owner_unverified' }

/**
 * Collega/crea l'owner cloud a partire dal profilo provider (SEC-002).
 * Regole:
 *  - email provider NON verificata → rifiuto (mai fidarsi della sola presenza dell'email).
 *  - oauth account già esistente (provider, providerUserId) → login diretto su quell'owner.
 *  - email corrisponde a owner esistente:
 *      • owner email_verified → link consentito (crea cloud_oauth_accounts).
 *      • owner NON verificato → RIFIUTO (no merge silenzioso, anti-hijacking).
 *  - nessun owner → crea nuovo owner (email_verified=true perché il provider l'ha confermata).
 */
async function resolveOwner(provider: Provider, profile: ProviderProfile): Promise<ResolveResult> {
  if (!profile.email || !profile.emailVerified) {
    return { kind: 'refused', reason: 'unverified_email' }
  }

  // 1) Account OAuth già collegato → login diretto.
  const [existingLink] = await cloudDb
    .select()
    .from(cloudOauthAccounts)
    .where(and(eq(cloudOauthAccounts.provider, provider), eq(cloudOauthAccounts.providerUserId, profile.providerUserId)))
    .limit(1)
  if (existingLink) {
    const [owner] = await cloudDb.select().from(cloudOwners).where(eq(cloudOwners.id, existingLink.ownerId)).limit(1)
    if (owner) {
      return { kind: 'owner', ownerId: owner.id, credentialsVersion: owner.credentialsVersion, created: false, linked: false }
    }
  }

  // 2) Owner con la stessa email.
  const [owner] = await cloudDb.select().from(cloudOwners).where(eq(cloudOwners.email, profile.email)).limit(1)
  if (owner) {
    if (!owner.emailVerified) {
      // SEC-002: niente merge silenzioso su un account non verificato.
      return { kind: 'refused', reason: 'owner_unverified' }
    }
    // Link OAuth all'owner verificato (idempotente: unique (owner_id, provider)).
    await cloudDb
      .insert(cloudOauthAccounts)
      .values({
        ownerId: owner.id,
        provider,
        providerUserId: profile.providerUserId,
        emailAtProvider: profile.email,
        emailVerifiedAtProvider: true,
      })
      .onConflictDoNothing()
    return { kind: 'owner', ownerId: owner.id, credentialsVersion: owner.credentialsVersion, created: false, linked: true }
  }

  // 3) Nessun owner → crea nuovo (password_hash null = solo-OAuth; email_verified perché provider conferma).
  const [created] = await cloudDb
    .insert(cloudOwners)
    .values({ email: profile.email, passwordHash: null, name: null, emailVerified: true })
    .returning()
  await cloudDb.insert(cloudOauthAccounts).values({
    ownerId: created!.id,
    provider,
    providerUserId: profile.providerUserId,
    emailAtProvider: profile.email,
    emailVerifiedAtProvider: true,
  })
  return { kind: 'owner', ownerId: created!.id, credentialsVersion: created!.credentialsVersion, created: true, linked: false }
}

export async function cloudOAuthRoutes(fastify: FastifyInstance) {
  const google = oauthProviderConfig('google')
  const github = oauthProviderConfig('github')

  // ─── GOOGLE ────────────────────────────────────────────────────────────────
  if (google) {
    await fastify.register(oauthPlugin, {
      name: 'googleOAuth2',
      scope: ['openid', 'email', 'profile'], // scope minimi
      credentials: { client: { id: google.clientId, secret: google.clientSecret } },
      discovery: { issuer: 'https://accounts.google.com' },
      startRedirectPath: '/google',
      callbackUri: oauthCallbackUri('google'),
      pkce: 'S256', // Google supporta PKCE → difesa extra oltre allo state cookie
      cookie: oauthStateCookie(),
    })

    fastify.get('/google/callback', async (req, reply) => {
      try {
        const { token } = await fastify.googleOAuth2!.getAccessTokenFromAuthorizationCodeFlow(req, reply)
        const profile = await googleProfile(token.access_token)
        return finishCallback(fastify, req, reply, 'google', profile)
      } catch (err) {
        req.log.error({ err: (err as Error).message }, 'google oauth callback error')
        await audit({ event: 'oauth_state_invalid', req, meta: { provider: 'google' } })
        return reply.redirect(siteBaseUrl() + '/?oauth_error=1')
      }
    })
  } else {
    fastify.log.warn('OAuth Google non configurato (GOOGLE_CLIENT_ID/SECRET assenti): route /google non montata.')
  }

  // ─── GITHUB ──────────────────────────────────────────────────────────────────
  if (github) {
    await fastify.register(oauthPlugin, {
      name: 'githubOAuth2',
      scope: ['read:user', 'user:email'], // scope minimi: profilo + email
      credentials: {
        client: { id: github.clientId, secret: github.clientSecret },
        // GITHUB_CONFIGURATION è una proprietà statica del plugin (host/path GitHub).
        auth: (oauthPlugin as unknown as { GITHUB_CONFIGURATION: import('@fastify/oauth2').ProviderConfiguration }).GITHUB_CONFIGURATION,
      },
      startRedirectPath: '/github',
      callbackUri: oauthCallbackUri('github'),
      cookie: oauthStateCookie(),
      // GitHub non supporta PKCE in modo affidabile → si fa affidamento sullo state cookie (SEC-006).
    })

    fastify.get('/github/callback', async (req, reply) => {
      try {
        const { token } = await fastify.githubOAuth2!.getAccessTokenFromAuthorizationCodeFlow(req, reply)
        const profile = await githubProfile(token.access_token)
        return finishCallback(fastify, req, reply, 'github', profile)
      } catch (err) {
        req.log.error({ err: (err as Error).message }, 'github oauth callback error')
        await audit({ event: 'oauth_state_invalid', req, meta: { provider: 'github' } })
        return reply.redirect(siteBaseUrl() + '/?oauth_error=1')
      }
    })
  } else {
    fastify.log.warn('OAuth GitHub non configurato (GITHUB_CLIENT_ID/SECRET assenti): route /github non montata.')
  }
}

// Logica condivisa post-token: risolve l'owner, crea la sessione, redirect allowlist.
async function finishCallback(
  fastify: FastifyInstance,
  req: import('fastify').FastifyRequest,
  reply: import('fastify').FastifyReply,
  provider: Provider,
  profile: ProviderProfile,
) {
  const result = await resolveOwner(provider, profile)

  if (result.kind === 'refused') {
    if (result.reason === 'unverified_email') {
      await audit({ event: 'oauth_email_unverified', req, meta: { provider } })
      return reply.redirect(siteBaseUrl() + '/?oauth_error=email_unverified')
    }
    await audit({ event: 'oauth_link_refused', req, meta: { provider, reason: result.reason } })
    return reply.redirect(siteBaseUrl() + '/?oauth_error=verify_existing_account')
  }

  await issueCloudSession(reply, {
    ownerId: result.ownerId,
    credentialsVersion: result.credentialsVersion,
    ip: req.ip,
    userAgent: req.headers['user-agent'] ?? null,
  })
  await cloudDb.update(cloudOwners).set({ lastLoginAt: new Date() }).where(eq(cloudOwners.id, result.ownerId))

  if (result.created) await audit({ event: 'oauth_account_created', ownerId: result.ownerId, req, meta: { provider } })
  else if (result.linked) await audit({ event: 'oauth_account_linked', ownerId: result.ownerId, req, meta: { provider } })
  await audit({ event: 'oauth_login_success', ownerId: result.ownerId, req, meta: { provider } })

  // SEC-005: redirect solo verso l'allowlist SITE_BASE_URL (mai token in URL).
  const next = (req.query as Record<string, unknown>)?.['next']
  return reply.redirect(safeRedirect(typeof next === 'string' ? next : undefined))
}
