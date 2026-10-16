import {randomBytes,randomUUID,createHash} from 'node:crypto'
import bcrypt from 'bcryptjs'
import {db} from '@tako/db'
import {sql} from 'drizzle-orm'
import {isAgencyUser} from './agency-access.js'
import type {OnboardingSession} from './onboarding-store.js'
import {twilioBase} from './twilio-menu-ai.js'
const hash=(s:string)=>createHash('sha256').update(s).digest('hex')
const origin='https://takoitalia.com'
const clean=(s:string)=>s.replace(/[*_~`<>]/g,'').slice(0,150)
export function ownerInviteCommand(text:string){return text.trim().match(/^attiva takomenu ([a-f0-9]{64})$/i)?.[1]?.toLowerCase()??null}
export function ownerInviteUrl(raw:string){const number=(process.env.TWILIO_WHATSAPP_NUMBER||'').replace(/\D/g,'');if(!number)throw Error('Mittente WhatsApp non configurato');return `https://wa.me/${number}?text=${encodeURIComponent('attiva takomenu '+raw)}`}
/** Issued only after publication; the bearer token alone never authorizes a different phone. */
export async function createOwnerInvite(s:OnboardingSession,connection:Pick<typeof db,'execute'>=db){
 if(s.state!=='activated'||!s.restaurantId||!s.data.ownerPhone||!s.data.ownerName||!isAgencyUser(s.actorId))throw Error('Locale non attivato')
 const raw=randomBytes(32).toString('hex'),url=ownerInviteUrl(raw)
 const rows=await connection.execute(sql`INSERT INTO tako_onboarding_owner_invites(token_hash,session_id,restaurant_id,owner_phone,owner_name,expires_at) SELECT ${hash(raw)},s.id,s.restaurant_id,${'whatsapp:'+s.data.ownerPhone},${s.data.ownerName},now()+interval '7 days' FROM tako_onboarding_sessions s JOIN users u ON u.id=s.actor_id WHERE s.id=${s.id} AND s.actor_id=${s.actorId} AND s.state='activated' AND s.revision=${s.revision} AND u.active=true RETURNING token_hash`)
 if(!rows.length)throw Error('Invito non disponibile')
 return{url,qrUrl:`${origin}/api/onboarding/owner-qr/${raw}`}
}
export async function readOwnerInviteQr(raw:unknown,connection:Pick<typeof db,'execute'>=db){
 if(typeof raw!=='string'||!/^[a-f0-9]{64}$/.test(raw))return null
 const rows=await connection.execute(sql`SELECT s.actor_id FROM tako_onboarding_owner_invites i JOIN tako_onboarding_sessions s ON s.id=i.session_id JOIN users u ON u.id=s.actor_id JOIN restaurants r ON r.id=i.restaurant_id WHERE i.token_hash=${hash(raw)} AND i.used_at IS NULL AND i.expires_at>now() AND s.state='activated' AND s.restaurant_id=i.restaurant_id AND u.active=true AND r.active=true`)
 return rows[0]&&isAgencyUser(String(rows[0].actor_id))?ownerInviteUrl(raw):null
}
/** Caller must validate the Twilio signature/account/recipient before invoking this helper. */
export async function activateOwnerInvite(phone:string,text:string,connection:Pick<typeof db,'transaction'>=db):Promise<string[]|null>{
 const raw=ownerInviteCommand(text);if(!raw)return null
 const passwordHash=await bcrypt.hash(randomBytes(48).toString('base64url'),12)
 try{return await connection.transaction(async tx=>{
  const rows=await tx.execute(sql`SELECT i.*,s.actor_id AS agency_actor,s.data,r.active AS restaurant_active FROM tako_onboarding_owner_invites i JOIN tako_onboarding_sessions s ON s.id=i.session_id JOIN restaurants r ON r.id=i.restaurant_id JOIN users u ON u.id=s.actor_id WHERE i.token_hash=${hash(raw)} AND i.expires_at>now() AND s.state='activated' AND s.restaurant_id=i.restaurant_id AND u.active=true FOR UPDATE OF i,s`)
  const i=rows[0];if(!i||!i.restaurant_active||!isAgencyUser(String(i.agency_actor)))return ['L’*invito* non è più valido. Chiedi un nuovo link all’agenzia.']
  if(i.owner_phone!==phone)return ['Apri il *link personale* dal numero WhatsApp comunicato all’agenzia.']
  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${String((i.data as any).ownerEmail||'').toLowerCase()},0))`)
  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${phone},0))`)
  const links=await tx.execute(sql`SELECT actor_id,restaurant_id FROM tako_whatsapp_links WHERE phone=${phone} OR restaurant_id=${i.restaurant_id}`)
  if(i.used_at){if(links.some(l=>l.actor_id===i.owner_actor_id&&l.restaurant_id===i.restaurant_id))return ['Il tuo *WhatsApp è collegato*. Scrivimi cosa vuoi cambiare nel menu.'];return ['L’*invito* è già stato usato. Contatta l’agenzia.']}
  const data=i.data as any,email=String(data.ownerEmail||'').toLowerCase()
  const users=await tx.execute(sql`SELECT id,restaurant_id,role,active FROM users WHERE lower(email)=${email}`)
  let actor:string
  if(users.length){const owner=users[0]!;if(owner.restaurant_id!==i.restaurant_id||owner.role!=='owner'||!owner.active)return ['Questa *email* è già collegata a un altro account. Contatta l’agenzia.'];actor=String(owner.id)}else{actor=randomUUID();await tx.execute(sql`INSERT INTO users(id,restaurant_id,name,email,password_hash,role,phone,active,email_verified) VALUES(${actor},${i.restaurant_id},${i.owner_name},${email},${passwordHash},'owner',${String(phone).replace('whatsapp:','')},true,false)`)}
  if(links.some(l=>l.restaurant_id!==i.restaurant_id||l.actor_id!==actor))throw Error('LINK_CONFLICT')
  await tx.execute(sql`INSERT INTO tako_whatsapp_links(phone,restaurant_id,actor_id,activated_at) VALUES(${phone},${i.restaurant_id},${actor},now()) ON CONFLICT(phone) DO UPDATE SET activated_at=now() WHERE tako_whatsapp_links.restaurant_id=EXCLUDED.restaurant_id AND tako_whatsapp_links.actor_id=EXCLUDED.actor_id`)
  await tx.execute(sql`UPDATE tako_onboarding_owner_invites SET used_at=now(),owner_actor_id=${actor} WHERE session_id=${i.session_id} AND used_at IS NULL`)
  return [`Benvenuto *${clean(String(i.owner_name))}* nel Takomenu di *${clean(String(data.name))}*.`,'Scrivimi o manda un vocale per cambiare *piatti, prezzi e disponibilità*. Fino a *3 modifiche* le applico subito. Per più modifiche ti chiedo un *OK scritto*.']
 })}catch{return ['Non riesco a collegare il *numero*. Contatta l’agenzia.']}
}
export async function sendOwnerInviteQr(to:string,mediaUrl:string){
 if(!/^https:\/\/takoitalia\.com\/api\/onboarding\/owner-qr\/[a-f0-9]{64}$/.test(mediaUrl))throw Error('QR non valido')
 const sid=process.env.TWILIO_ACCOUNT_SID||'',token=process.env.TWILIO_AUTH_TOKEN||''
 const response=await fetch(`${twilioBase()}/2010-04-01/Accounts/${sid}/Messages.json`,{method:'POST',headers:{Authorization:'Basic '+Buffer.from(sid+':'+token).toString('base64'),'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({From:process.env.TWILIO_WHATSAPP_NUMBER||'',To:to,Body:'*QR personale del titolare*. Inoltralo insieme al link: funziona solo dal *suo numero WhatsApp*.',MediaUrl:mediaUrl}),signal:AbortSignal.timeout(10000)})
 if(!response.ok)throw Error('Invio QR non riuscito')
}
