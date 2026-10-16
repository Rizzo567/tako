import {randomBytes,randomUUID,createHash} from 'node:crypto'
import {db,type DB} from '@tako/db'
import {sql} from 'drizzle-orm'
import {isAgencyUser} from './agency-access.js'
import {workspaceSchema} from './menu-workspace-contract.js'
const hash=(x:string)=>createHash('sha256').update(x).digest('hex')
export const onboardingLifecycleCommand=(text:string)=>text.trim().match(/^(avvia|riprendi) onboarding ([a-f0-9]{64})$/i)

export async function agencyStartActor(text:string,connection:Pick<DB,'execute'>=db){const command=onboardingLifecycleCommand(text);if(!command||command[1]!.toLowerCase()!=='avvia')return null;const rows=await connection.execute(sql`SELECT t.actor_id FROM tako_onboarding_agency_tokens t JOIN users u ON u.id=t.actor_id WHERE t.token_hash=${hash(command[2]!.toLowerCase())} AND t.session_id IS NULL AND t.used_at IS NULL AND t.expires_at>now() AND u.active=true`);const actor=String(rows[0]?.actor_id||'');return actor&&isAgencyUser(actor)?actor:null}
export async function purgeExpiredOnboarding(connection:Pick<DB,'execute'>=db){await connection.execute(sql`SELECT tako_purge_expired_onboarding()`)}
export async function touchOnboardingActivity(actor:string,phone:string,connection:Pick<DB,'execute'>=db){await connection.execute(sql`UPDATE tako_onboarding_sessions SET last_activity_at=now(),expires_at=now()+interval '10 minutes' WHERE actor_id=${actor} AND phone=${phone} AND state IN('collecting','review') AND expires_at>now()`)}
export async function createAgencyOnboardingCode(actor:string,sessionId:string|null,connection:DB=db){
 if(!isAgencyUser(actor))throw Error('Accesso *agenzia* non disponibile.')
 const raw=randomBytes(32).toString('hex'),number=(process.env.TWILIO_WHATSAPP_NUMBER||'').replace(/\D/g,'');if(!number)throw Error('Il servizio *WhatsApp* non è disponibile. Contatta l’assistenza.')
 return connection.transaction(async tx=>{await purgeExpiredOnboarding(tx as any);const users=await tx.execute(sql`SELECT id FROM users WHERE id=${actor} AND active=true`);if(!users.length)throw Error('Accesso *agenzia* non disponibile.');if(sessionId){const sessions=await tx.execute(sql`SELECT id FROM tako_onboarding_sessions WHERE id=${sessionId} AND actor_id=${actor} AND state IN('collecting','review') AND expires_at>now()`);if(!sessions.length)throw Error('La *bozza* è scaduta o non è disponibile.')}
 const rows=await tx.execute(sql`INSERT INTO tako_onboarding_agency_tokens(token_hash,actor_id,session_id,expires_at) VALUES(${hash(raw)},${actor},${sessionId},LEAST(now()+interval '10 minutes',COALESCE((SELECT expires_at FROM tako_onboarding_sessions WHERE id=${sessionId}),now()+interval '10 minutes'))) RETURNING expires_at`)
 return{url:`https://wa.me/${number}?text=${encodeURIComponent((sessionId?'riprendi':'avvia')+' onboarding '+raw)}`,qrUrl:`https://takoitalia.com/api/onboarding/agency-qr/${raw}`,expiresAt:rows[0]!.expires_at,expiresIn:600}
 })
}
export async function readAgencyOnboardingQr(raw:unknown,connection:Pick<DB,'execute'>=db){
 if(typeof raw!=='string'||!/^[a-f0-9]{64}$/.test(raw))return null
 const rows=await connection.execute(sql`SELECT t.actor_id,t.session_id FROM tako_onboarding_agency_tokens t JOIN users u ON u.id=t.actor_id LEFT JOIN tako_onboarding_sessions s ON s.id=t.session_id WHERE t.token_hash=${hash(raw)} AND t.used_at IS NULL AND t.expires_at>now() AND u.active=true AND (t.session_id IS NULL OR (s.actor_id=t.actor_id AND s.state IN('collecting','review') AND s.expires_at>now()))`);const token=rows[0];if(!token||!isAgencyUser(String(token.actor_id)))return null
 return `https://wa.me/${(process.env.TWILIO_WHATSAPP_NUMBER||'').replace(/\D/g,'')}?text=${encodeURIComponent((token.session_id?'riprendi':'avvia')+' onboarding '+raw)}`
}
/** A bearer QR never grants agency access. Redemption requires an independently paired active agency phone. */
export async function redeemAgencyOnboardingCode(actor:string,phone:string,text:string,connection:DB=db){
 const command=onboardingLifecycleCommand(text);if(!command)return null
 if(!isAgencyUser(actor))throw Error('Accesso *agenzia* non disponibile.')
 return connection.transaction(async tx=>{await purgeExpiredOnboarding(tx as any);await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${`onboarding:${actor}:${phone}`},0))`)
 const paired=await tx.execute(sql`SELECT l.actor_id FROM tako_onboarding_agency_links l JOIN users u ON u.id=l.actor_id WHERE l.phone=${phone} AND l.actor_id=${actor} AND u.active=true`);if(!paired.length&&command[1]!.toLowerCase()!=='avvia')throw Error('Collega prima il *telefono agenzia* dalla dashboard.')
 if(command[1]!.toLowerCase()==='riprendi'){const target=await tx.execute(sql`SELECT session_id FROM tako_onboarding_agency_tokens WHERE token_hash=${hash(command[2]!.toLowerCase())} AND used_at IS NULL AND expires_at>now()`);if(!target[0]?.session_id)throw Error('Il *QR* è scaduto o già usato. Creane uno nuovo dalla dashboard.');await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${`onboarding-resume:${target[0].session_id}`},0))`)}
 const tokens=await tx.execute(sql`SELECT t.actor_id,t.session_id FROM tako_onboarding_agency_tokens t JOIN users u ON u.id=t.actor_id WHERE t.token_hash=${hash(command[2]!.toLowerCase())} AND t.used_at IS NULL AND t.expires_at>now() AND u.active=true FOR UPDATE OF t`),token=tokens[0];if(!token||String(token.actor_id)!==actor||!isAgencyUser(String(token.actor_id))||!!token.session_id!==(command[1]!.toLowerCase()==='riprendi'))throw Error('Il *QR* è scaduto o già usato. Creane uno nuovo dalla dashboard.')
 if(!paired.length){const links=await tx.execute(sql`SELECT actor_id FROM tako_onboarding_agency_links WHERE phone=${phone}`);if(links.length)throw Error('Questo *numero* è già collegato a un’altra agenzia.');await tx.execute(sql`INSERT INTO tako_onboarding_agency_links(phone,actor_id) VALUES(${phone},${actor})`)}
 const existing=await tx.execute(sql`SELECT id FROM tako_onboarding_sessions WHERE actor_id=${actor} AND phone=${phone} AND state IN('collecting','review') AND expires_at>now() AND (data->>'paused') IS DISTINCT FROM 'true'`);if(existing.length&&existing[0]!.id!==token.session_id)throw Error('Hai una *bozza aperta*. Completala o annullala prima di iniziare.')
 let id:string
 if(token.session_id){id=String(token.session_id);const changed=await tx.execute(sql`UPDATE tako_onboarding_sessions SET phone=${phone},data=data-'paused',revision=revision+1,preview_token_hash=NULL,last_activity_at=now(),expires_at=now()+interval '10 minutes',updated_at=now() WHERE id=${id} AND actor_id=${actor} AND state IN('collecting','review') AND expires_at>now() RETURNING id`);if(!changed.length)throw Error('La *bozza* è scaduta o non è disponibile.');await tx.execute(sql`UPDATE tako_onboarding_tokens SET used_at=now() WHERE session_id=${id} AND kind='preview' AND used_at IS NULL`);await tx.execute(sql`UPDATE tako_onboarding_agency_tokens SET used_at=now() WHERE session_id=${id} AND used_at IS NULL`)}
 else{id=randomUUID();const data={name:'',slug:'',workspace:workspaceSchema.parse({menus:[]}),warnings:[],unresolved:[]};await tx.execute(sql`INSERT INTO tako_onboarding_sessions(id,actor_id,phone,data) VALUES(${id},${actor},${phone},${JSON.stringify(data)}::jsonb)`)}
 await tx.execute(sql`UPDATE tako_onboarding_agency_tokens SET used_at=now() WHERE token_hash=${hash(command[2]!.toLowerCase())}`);return{id}
 })
}
