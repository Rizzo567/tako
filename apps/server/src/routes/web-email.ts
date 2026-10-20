import { Buffer } from 'node:buffer'
import type { FastifyInstance } from 'fastify'
import { randomBytes, randomUUID, createHash, timingSafeEqual } from 'node:crypto'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { db, users, sessions } from '@tako/db'
import { sql, eq } from 'drizzle-orm'
import { requireAuth } from '../middleware/auth.js'
import { isAgencyUser } from '../lib/agency-access.js'
import { enqueueEmail, processEmailOutbox } from '../lib/transactional-email/outbox.js'
import { materializeWelcomeEmails } from '../lib/transactional-email/welcome.js'
import { emailAccountPage } from '../lib/transactional-email/account-page.js'
const tokenHash = (value: string) => createHash('sha256').update(value).digest('hex')
const invalid = { error: { code: 'INVALID_EMAIL_CHANGE', message: 'Link non valido o scaduto. Richiedi un nuovo cambio email.' } }
const emailRule = z.string().trim().email().max(254).transform(value => value.toLowerCase())
export const validEmailCronSecret = (value: unknown, secret = process.env.EMAIL_CRON_SECRET) => {
  if(typeof value!=='string'||typeof secret!=='string'||secret.length<32)return false
  const a=Buffer.from(value),b=Buffer.from(secret)
  return a.length===b.length&&timingSafeEqual(a,b)
}

export async function registerWebEmailRoutes(app: FastifyInstance) {
  app.get('/email/settings', async (_req, reply) => {
    const nonce = randomBytes(18).toString('base64')
    return reply.header('X-Takomenu-Email-Nonce',nonce).header('Cache-Control', 'no-store').header('Content-Security-Policy', `default-src 'none'; script-src 'nonce-${nonce}'; style-src 'nonce-${nonce}'; connect-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'`).type('text/html').send(emailAccountPage(nonce, false))
  })
  app.get('/email/confirm', async (_req, reply) => {
    const nonce = randomBytes(18).toString('base64')
    return reply.header('X-Takomenu-Email-Nonce',nonce).header('Cache-Control', 'no-store').header('Referrer-Policy', 'no-referrer').header('Content-Security-Policy', `default-src 'none'; script-src 'nonce-${nonce}'; style-src 'nonce-${nonce}'; connect-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'`).type('text/html').send(emailAccountPage(nonce, true))
  })
  app.get('/email/status', { preHandler: requireAuth }, async req => {
    const [user] = await db.select({email: users.email}).from(users).where(eq(users.id, req.user!.id)).limit(1)
    const pending = await db.execute(sql`select new_email,expires_at from tako_email_changes where user_id=${req.user!.id} and consumed_at is null and expires_at>now() order by created_at desc limit 1`)
    return {data: {email: user?.email, pending: pending[0] ?? null}}
  })
  app.post('/email/request', { preHandler: requireAuth, config: {rateLimit: {max: 5,timeWindow: 3600000}} }, async (req, reply) => {
    const parsed = z.object({email:emailRule,currentPassword:z.string().min(1).max(128)}).safeParse(req.body)
    if (!parsed.success) return reply.code(400).send({error:{code:'VALIDATION',message:'Inserisci email e password attuale.'}})
    const [user] = await db.select().from(users).where(sql`${users.id}=${req.user!.id} and ${users.active}=true`).limit(1)
    if (!user || !((user.passwordHash && await bcrypt.compare(parsed.data.currentPassword,user.passwordHash)) || (user.localOwnerSecretHash && await bcrypt.compare(parsed.data.currentPassword,user.localOwnerSecretHash)))) return reply.code(400).send({error:{code:'WRONG_PASSWORD',message:'La password attuale non è corretta.'}})
    if (user.email.toLowerCase() === parsed.data.email) return reply.code(400).send({error:{code:'SAME_EMAIL',message:'Stai già usando questa email.'}})
    const origin = process.env.WEB_ORIGIN
    if (!origin?.startsWith('https://')) return reply.code(503).send({error:{code:'UNAVAILABLE',message:'Riprova più tardi.'}})
    const raw = randomBytes(32).toString('base64url'), id = randomUUID(), expiresAt = new Date(Date.now()+30*60000)
    const result = await db.transaction(async tx => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${'account:'+user.id},0))`)
      const current = await tx.execute(sql`select email,password_hash,local_owner_secret_hash from users where id=${user.id} and active=true for update`)
      if (!current[0] || current[0].email !== user.email || current[0].password_hash !== user.passwordHash || current[0].local_owner_secret_hash !== user.localOwnerSecretHash) return 'stale'
      const used = await tx.execute(sql`select id from users where lower(email)=${parsed.data.email} and id<>${user.id} limit 1`)
      if (used.length) return 'taken'
      const recent = await tx.execute(sql`select count(*)::int as n from tako_email_changes where user_id=${user.id} and created_at>now()-interval '1 hour'`)
      if (Number(recent[0]?.n) >= 3) return 'rate'
      await tx.execute(sql`update tako_email_changes set consumed_at=now() where user_id=${user.id} and consumed_at is null`)
      await tx.execute(sql`insert into tako_email_changes(id,user_id,old_email,new_email,token_hash,credential_hash,expires_at) values(${id},${user.id},${user.email},${parsed.data.email},${tokenHash(raw)},${tokenHash((user.passwordHash||'')+'|'+(user.localOwnerSecretHash||''))},${expiresAt.toISOString()})`)
      await enqueueEmail(tx,{key:'email-confirm:'+id,userId:user.id,recipient:parsed.data.email,template:'conferma-email',values:{nome_titolare:user.name,nuova_email:parsed.data.email,link_conferma:origin+'/api/web-accounts/email/confirm?token='+raw},expiresAt,guard:{kind:'email-change',id}})
      await enqueueEmail(tx,{key:'email-notice:'+id,userId:user.id,recipient:user.email,template:'avviso-cambio-email',values:{nome_titolare:user.name,nuova_email:parsed.data.email}})
      return 'ok'
    })
    if(result !== 'ok')return reply.code(result==='rate'?429:409).send({error:{code:result==='taken'?'EMAIL_UNAVAILABLE':'RETRY',message:result==='taken'?'Non puoi usare questo indirizzo.':result==='rate'?'Hai già richiesto tre cambi. Riprova tra un’ora.':'I tuoi dati sono cambiati. Riprova.'}})
    try{await processEmailOutbox(undefined,2)}catch{req.log.warn({event:'email_queue_tick_failed'})}
    return {data:{pending:true,message:'Controlla la nuova email e conferma entro 30 minuti.'}}
  })
  app.post('/email/confirm', {config:{rateLimit:{max:10,timeWindow:60000}}}, async(req,reply)=>{
    const parsed=z.object({token:z.string().min(32).max(128)}).safeParse(req.body)
    if(!parsed.success)return reply.code(400).send(invalid)
    const result=await db.transaction(async tx=>{
      const lookup=await tx.execute(sql`select user_id from tako_email_changes where token_hash=${tokenHash(parsed.data.token)} and consumed_at is null and expires_at>now()`)
      if(!lookup[0])return 'invalid'
      await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${'account:'+String(lookup[0].user_id)},0))`)
      const rows=await tx.execute(sql`select * from tako_email_changes where token_hash=${tokenHash(parsed.data.token)} and consumed_at is null and expires_at>now() for update`)
      const change=rows[0];if(!change)return 'invalid'
      await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${String(change.new_email)},0))`)
      const current=await tx.execute(sql`select email,password_hash,local_owner_secret_hash from users where id=${change.user_id} and active=true for update`)
      if(!current[0]||current[0].email!==change.old_email||tokenHash(String(current[0].password_hash||'')+'|'+String(current[0].local_owner_secret_hash||''))!==change.credential_hash)return 'invalid'
      if((await tx.execute(sql`select id from users where lower(email)=${change.new_email} and id<>${change.user_id} limit 1`)).length)return 'taken'
      await tx.execute(sql`update users set email=${change.new_email},email_verified=true where id=${change.user_id}`)
      await tx.execute(sql`update tako_whatsapp_links set owner_email=${change.new_email} where actor_id=${change.user_id} and lower(owner_email)=${String(change.old_email).toLowerCase()}`)
      await tx.delete(sessions).where(eq(sessions.userId,String(change.user_id)))
      await tx.execute(sql`update web_password_resets set consumed_at=now() where user_id=${change.user_id} and consumed_at is null`)
      await tx.execute(sql`update tako_email_changes set consumed_at=now() where user_id=${change.user_id} and consumed_at is null`)
      return 'ok'
    })
    if(result!=='ok')return reply.code(result==='taken'?409:400).send(invalid)
    return {data:{confirmed:true,message:'Email confermata. Accedi con il nuovo indirizzo e la tua password.'}}
  })
  app.post('/email/tick', async(req,reply)=>{
    if(!validEmailCronSecret(req.headers['x-tako-cron-secret']))return reply.code(404).send({error:{code:'NOT_FOUND',message:'Not found'}})
    const welcome=await materializeWelcomeEmails()
    return {data:{welcome,...await processEmailOutbox()}}
  })
  app.post('/email/service', {preHandler:requireAuth,config:{rateLimit:{max:3,timeWindow:3600000}}}, async(req,reply)=>{
    if(!isAgencyUser(req.user!.id))return reply.code(403).send({error:{code:'FORBIDDEN',message:'Accesso riservato all’agenzia.'}})
    const parsed=z.object({approved:z.literal(true),requestId:z.string().uuid(),userIds:z.array(z.string().uuid()).min(1).max(20),title:z.string().trim().min(1).max(150),text:z.string().trim().min(1).max(3000),actionUrl:z.string().url().optional(),actionLabel:z.string().trim().min(1).max(60).optional()}).safeParse(req.body)
    if(!parsed.success)return reply.code(400).send({error:{code:'VALIDATION',message:'Indica destinatari e testo approvato.'}})
    const d=parsed.data
    if(!!d.actionUrl!==!!d.actionLabel||d.actionUrl&&!d.actionUrl.startsWith('https://'))return reply.code(400).send({error:{code:'VALIDATION',message:'Controlla il pulsante.'}})
    await db.transaction(async tx=>{for(const id of new Set(d.userIds)){
      const rows=await tx.execute(sql`select u.name,u.email,r.name as restaurant_name from users u join restaurants r on r.id=u.restaurant_id where u.id=${id} and u.active=true and u.role='owner' and r.active=true`)
      if(!rows[0])throw new Error('Invalid service recipient')
      await enqueueEmail(tx,{key:'service:'+d.requestId+':'+id,userId:id,recipient:String(rows[0].email),template:'servizio',values:{nome_titolare:String(rows[0].name),nome_locale:String(rows[0].restaurant_name),titolo:d.title,testo:d.text,...d.actionUrl?{link_azione:d.actionUrl,etichetta_bottone:d.actionLabel!}:{}}})
    }})
    return {data:{queued:true}}
  })
}
