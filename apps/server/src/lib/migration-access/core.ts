import { Buffer as MigrationBuffer } from 'node:buffer'
import { createCipheriv as migrationCipher, createDecipheriv as migrationDecipher, createHash as migrationHash, randomBytes as migrationRandomBytes, randomUUID as migrationUUID } from 'node:crypto'

export const TEMP_PASSWORD_TTL_MS = 48 * 60 * 60 * 1000
export function validUsername(value: unknown): value is string { return typeof value === 'string' && /^[a-z0-9][a-z0-9-]{2,47}$/.test(value) }
export function passwordChangeAllowed(path: string, method: string) {
  const p = path.split('?')[0]!.replace(/\/+$/, '')
  return method === 'GET' && ['/api/auth/me', '/api/auth/bootstrap'].includes(p) || method === 'POST' && ['/api/auth/logout', '/api/auth/migration-password'].includes(p)
}
export function validNewPassword(value: unknown) { return typeof value === 'string' && value.length >= 10 && MigrationBuffer.byteLength(value, 'utf8') <= 72 && !/^\s+$/.test(value) }
export function sealTemporaryPassword(password: string, secret: string, context: string) {
  if (secret.length < 32) throw Error('Migration encryption unavailable')
  const iv = migrationRandomBytes(12), key = migrationHash('sha256').update('takomenu-migration-access:v1:' + secret).digest()
  const cipher = migrationCipher('aes-256-gcm', key, iv); cipher.setAAD(MigrationBuffer.from(context))
  const body = MigrationBuffer.concat([cipher.update(password, 'utf8'), cipher.final()])
  return ['v1', iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), body.toString('base64url')].join('.')
}
export function openTemporaryPassword(value: string, secret: string, context: string) {
  const [v, iv, tag, body] = value.split('.')
  if (v !== 'v1' || !iv || !tag || !body || secret.length < 32) throw Error('Invalid migration envelope')
  const key = migrationHash('sha256').update('takomenu-migration-access:v1:' + secret).digest(), d = migrationDecipher('aes-256-gcm', key, MigrationBuffer.from(iv, 'base64url'))
  d.setAAD(MigrationBuffer.from(context)); d.setAuthTag(MigrationBuffer.from(tag, 'base64url'))
  return MigrationBuffer.concat([d.update(MigrationBuffer.from(body, 'base64url')), d.final()]).toString('utf8')
}

/** Dependency injection keeps the migration delta independent from unrelated live bot releases. */
export function createMigrationAccess(deps: any) {
  const { db, sql, bcrypt, randomPassword, isAgencyUser, requireAuth, cookieName, cookieOptions, sessionMaxAge, nanoid, allowedTenants } = deps
  const rows = async (tx: any, query: any) => Array.from(await tx.execute(query)) as any[]
  const error = (reply: any, status: number, code: string, message: string) => reply.code(status).send({ error: { code, message } })
  const ctxOf = (r: any) => `${r.id}:${r.user_id}:${r.restaurant_id}`
  const key = () => String(process.env['JWT_SECRET'] || '')

  async function provision(tx: any, tenant: string, userId: string, phone: string, username: string) {
    if (!allowedTenants.includes(tenant) || !validUsername(username) || !/^whatsapp:\+\d{8,15}$/.test(phone)) throw Error('MIGRATION_INVALID_TARGET')
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${'migration:' + userId}))`)
    const [u] = await rows(tx, sql`select id,restaurant_id,role,active from users where id=${userId} for update`)
    if (!u || u.restaurant_id !== tenant || u.role !== 'owner' || !u.active || isAgencyUser(u.id)) throw Error('MIGRATION_INVALID_OWNER')
    const [link] = await rows(tx, sql`select actor_id from tako_whatsapp_links where phone=${phone} and restaurant_id=${tenant} for update`)
    if (!link || link.actor_id !== userId) throw Error('MIGRATION_OWNER_LINK_MISMATCH')
    const current = await rows(tx, sql`select id,state,expires_at from tako_migration_access where user_id=${userId} for update`)
    // Retries must never reset a password or resurrect completed migrations.
    if (current.length) return { id: current[0].id, state: current[0].state, alreadyPrepared: true }
    const collision = await rows(tx, sql`select id from users where lower(username)=${username} and id<>${userId}`)
    if (collision.length) throw Error('MIGRATION_USERNAME_TAKEN')
    const id = migrationUUID(), password = randomPassword(), hash = await bcrypt.hash(password, 12), expires = new Date(Date.now() + TEMP_PASSWORD_TTL_MS)
    const ciphertext = sealTemporaryPassword(password, key(), `${id}:${userId}:${tenant}`)
    await tx.execute(sql`insert into tako_migration_access(id,user_id,restaurant_id,phone,state,temp_cipher,expires_at) values(${id},${userId},${tenant},${phone},'ready',${ciphertext},${expires.toISOString()})`)
    await tx.execute(sql`update users set username=${username},password_hash=${hash},local_owner_secret_hash=null,must_change_password=true,temporary_password_expires_at=${expires.toISOString()},credentials_version=credentials_version+1 where id=${userId} and restaurant_id=${tenant}`)
    await tx.execute(sql`delete from sessions where user_id=${userId}`)
    return { id, state: 'ready', alreadyPrepared: false, username, expiresAt: expires.toISOString() }
  }

  async function turn(tx: any, ctx: any, body: string, media: number) {
    const [m] = await rows(tx, sql`select m.*,u.username,u.must_change_password from tako_migration_access m join users u on u.id=m.user_id where m.phone=${ctx.phone} and m.restaurant_id=${ctx.tenant} and m.user_id=${ctx.actor} for update of m`)
    if (!m) return null
    const menu = media === 0 && body.trim().toLocaleLowerCase('it') === 'menu'
    if (!menu) return m.state === 'ready' ? { say: 'Per ricevere il nuovo accesso a Takomenu rispondi *MENU*.' } : null
    if (!m.must_change_password || m.state === 'completed') return { say: `La tua dashboard: https://takoitalia.com/staff/\nNome utente: ${m.username}\nUsa la password che hai scelto al primo accesso.` }
    if (new Date(m.expires_at).getTime() <= Date.now()) return { say: 'La password provvisoria è scaduta. Contatta Tako per ricevere un nuovo accesso.' }
    const password = openTemporaryPassword(m.temp_cipher, key(), ctxOf(m))
    await tx.execute(sql`update tako_migration_access set state='delivered',last_requested_at=now() where id=${m.id}`)
    await tx.execute(sql`update tako_whatsapp_links set activated_at=coalesce(activated_at,now()),password_reissue=false where phone=${ctx.phone} and restaurant_id=${ctx.tenant}`)
    return { secret: `Il tuo nuovo accesso a Takomenu:\nhttps://takoitalia.com/staff/\n\nNome utente: ${m.username}\nPassword provvisoria: ${password}\n\nAl primo accesso scegli una nuova password. La provvisoria vale 48 ore.`, userId: m.user_id }
  }

  async function register(fastify: any) {
    fastify.post('/migration-password', { preHandler: requireAuth, config: { rateLimit: { max: 5, timeWindow: 900000 } } }, async (req: any, reply: any) => {
      const password = req.body?.password, confirm = req.body?.confirmPassword
      if (!validNewPassword(password) || password !== confirm) return error(reply, 400, 'VALIDATION', 'Inserisci due password uguali, da 10 a 72 caratteri (meno se usi simboli speciali).')
      const token = req.cookies?.[cookieName] ?? req.headers.authorization?.replace('Bearer ', '')
      const result = await db.transaction(async (tx: any) => {
        const [u] = await rows(tx, sql`select id,password_hash,must_change_password,temporary_password_expires_at from users where id=${req.user.id} and active=true for update`)
        if (!u?.must_change_password) return 'not_required'
        if (!u.temporary_password_expires_at || new Date(u.temporary_password_expires_at).getTime() <= Date.now()) return 'expired'
        const active = await rows(tx, sql`select id from sessions where user_id=${u.id} and token=${token} and expires_at>now()`)
        if (!active.length) return 'unauthorized'
        if (await bcrypt.compare(password, u.password_hash)) return 'same_password'
        const hash = await bcrypt.hash(password, 12)
        await tx.execute(sql`update users set password_hash=${hash},local_owner_secret_hash=null,must_change_password=false,temporary_password_expires_at=null,credentials_version=credentials_version+1 where id=${u.id}`)
        await tx.execute(sql`update tako_migration_access set state='completed',temp_cipher=null,completed_at=now() where user_id=${u.id}`)
        await tx.execute(sql`delete from sessions where user_id=${u.id}`)
        const fresh = nanoid(64), expires = new Date(Date.now() + sessionMaxAge * 1000)
        await tx.execute(sql`insert into sessions(user_id,token,expires_at) values(${u.id},${fresh},${expires.toISOString()})`)
        return { token: fresh }
      })
      if (result === 'same_password') return error(reply, 400, 'PASSWORD_UNCHANGED', 'Scegli una password diversa da quella provvisoria.')
      if (result === 'expired') return error(reply, 403, 'TEMP_PASSWORD_EXPIRED', 'La password provvisoria è scaduta. Contatta Tako.')
      if (result === 'unauthorized') return error(reply, 401, 'UNAUTHORIZED', 'Accedi di nuovo.')
      if (result === 'not_required') return error(reply, 409, 'PASSWORD_CHANGE_NOT_REQUIRED', 'La password è già stata aggiornata.')
      reply.setCookie(cookieName, result.token, cookieOptions(sessionMaxAge))
      return { data: { success: true, mustChangePassword: false } }
    })
    fastify.post('/migration-access/prepare', { preHandler: requireAuth, config: { rateLimit: { max: 10, timeWindow: 60000 } } }, async (req: any, reply: any) => {
      if (!isAgencyUser(req.user.id)) return error(reply, 403, 'FORBIDDEN', 'Operazione riservata a Tako.')
      const b = req.body || {}
      if (![b.restaurantId,b.userId].every((x: unknown) => typeof x === 'string' && /^[0-9a-f-]{36}$/i.test(x)) || !validUsername(b.username) || typeof b.phone !== 'string') return error(reply,400,'VALIDATION','Dati migrazione non validi.')
      try { return { data: await db.transaction((tx: any) => provision(tx,b.restaurantId,b.userId,b.phone,b.username)) } }
      catch (e: any) { if (/^MIGRATION_/.test(String(e.message))) return error(reply,409,e.message,'Verifica titolare, numero e nome utente prima di procedere.'); throw e }
    })
  }
  return { register, turn, provision }
}
