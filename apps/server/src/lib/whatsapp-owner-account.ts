// 19/10 (decisione Manuel, rivista lo stesso giorno): account della dashboard per il titolare collegato su WhatsApp.
// Nel pannello «WhatsApp del titolare» si salvano numero ed EMAIL del titolare. Al primo messaggio il bot crea (o ritrova) l'account
// owner del SOLO locale collegato (utente = email, password = tre parole) e manda link + credenziali in chat. Nel DB c'è solo l'hash
// bcrypt; la password in chiaro esiste solo nel messaggio in uscita. Niente gestione password in chat: si recupera dalla pagina di
// accesso (codice via email) o si cambia da dentro la dashboard.
import {randomInt,randomUUID} from 'node:crypto'
import bcrypt from 'bcryptjs'
import {sql} from 'drizzle-orm'
import {z} from 'zod'
import type {DB} from '@tako/db'
import {isAgencyUser} from './agency-access.js'
import {normalizeOwnerPhone} from './whatsapp-phone.js'
import {publicMenuPaths} from './public-menu-paths.js'
import {webOrigin} from './web-runtime.js'
type Exec=Pick<DB,'execute'>
const fallbackOrigin='https://takoitalia.com'
const origin=()=>{try{return webOrigin()}catch{return fallbackOrigin}}
export const dashboardUrl=()=>origin()+'/staff/'
/** Stesso indirizzo del QR al tavolo (vedi digitalMenuUrl). */
export function publicMenuUrl(tenant:string){if(!/^[0-9a-f-]{36}$/i.test(tenant))throw new Error('Invalid restaurant');return origin()+(publicMenuPaths[tenant]||`/r/${tenant}/menu`)}
// ~200 parole italiane corte, minuscole, senza accenti né doppioni sonori ambigui.
export const passwordWords=('acqua alba alce abete alga alpe ambra amico ancora anello ape arco aria arpa asse asta astro bacio baffo balena banco barca basco '+
 'bosco botte brodo bruco burro cane capra carta casa cedro cena cervo chiave cielo cigno cima coda colle conca corda corno corso costa cuore dado '+
 'delfino dente dito dolce domino drago duna erba estate faro fata fico filo fiore foca foglia fonte forno fragola frutto fumo fungo gallo gamba gatto '+
 'gelato gelso ghianda giglio gioco giorno gomma grano grillo guanto isola lago lampo lana lancia latte lauro lente leone libro lima limone lino lucciola '+
 'luna lupo mago mandorla mare marmo mela melone menta miele mirto molla monte mora muro nastro neve nido noce nota nuvola oca olio olivo onda orso '+
 'orto ostrica pace pagina palla palma pane papavero parco pasta pepe pera perla pesca pino pioggia pipa poeta polpo ponte porta porto prato quercia '+
 'radice rana ramo razzo riccio riso roccia rosa rospo ruota sabbia sale salvia sasso scala scoglio seme sedano sole sorriso spiga stella strada '+
 'tavolo tazza teatro tela tetto tigre timo topo torre torta trave treno tromba tulipano uovo uva vaso vela vento verde vetro viola vite volpe zaino '+
 'zebra zucca').split(' ')
/** Tre parole diverse separate da punto, es. «pane.sole.mare». */
// 27/10 (decisione Manuel, online dalla v188): due parole diverse con iniziale maiuscola, trattino, due cifre 00–99 («Barca-Ape07»).
export function simplePassword(pick:(n:number)=>number=randomInt):string{const first=pick(passwordWords.length),secondIndex=pick(passwordWords.length-1),second=secondIndex>=first?secondIndex+1:secondIndex,title=(w:string)=>w.charAt(0).toUpperCase()+w.slice(1);return title(passwordWords[first]!)+'-'+title(passwordWords[second]!)+String(pick(100)).padStart(2,'0')}
export type OwnerAccount={id:string,username:string,created:boolean,password?:string}|{blocked:true}
type Link={phone:string,tenant:string,actor:string}
/** 19/10 sera: stessa regola del login (auth.ts: z.string().trim().email()), così il pannello non accetta email che il login rifiuta. */
const emailRule=z.string().trim().max(254).email()
export const ownerEmailSchema=(raw:unknown)=>{const r=emailRule.safeParse(raw);return r.success?r.data.toLowerCase():null}
const isOwnerOf=(u:any,tenant:string)=>!!u&&u.restaurant_id===tenant&&u.role==='owner'&&u.active===true&&!isAgencyUser(String(u.id))
/** 19/10 sera: nome dell'account creato dal bot = «Titolare di <locale>» (la dashboard saluta col nome del locale). */
async function ownerName(tx:Exec,tenant:string){const rows=await tx.execute(sql`SELECT name FROM restaurants WHERE id=${tenant}`),name=String(rows[0]?.name??'').trim();return name?('Titolare di '+name).slice(0,120):'Titolare'}
/** Password nuova per un account titolare già esistente di questo locale; chiude le sessioni aperte. */
async function reissuePassword(tx:Exec,id:string,tenant:string):Promise<string|null>{const password=simplePassword(),hash=await bcrypt.hash(password,12)
 const rows=await tx.execute(sql`UPDATE users SET password_hash=${hash},local_owner_secret_hash=NULL WHERE id=${id} AND restaurant_id=${tenant} AND role='owner' RETURNING id`)
 if(!rows.length)return null;await tx.execute(sql`DELETE FROM sessions WHERE user_id=${id}`);return password}
/** 19/10 sera: il collegamento (e le azioni che fa da qui in poi) passa al titolare, non più all'agenzia che l'ha creato. */
async function adoptLink(tx:Exec,link:Link,id:string){if(link.actor===id)return;await tx.execute(sql`UPDATE tako_whatsapp_links SET actor_id=${id} WHERE phone=${link.phone} AND restaurant_id=${link.tenant}`);link.actor=id}
/** Password arrivata davvero (invio Twilio riuscito): da qui il bot non la rigenera più da solo. */
export async function markPasswordDelivered(tx:Exec,link:{phone:string,tenant:string},id:string){
 await tx.execute(sql`UPDATE users SET password_delivered_at=now() WHERE id=${id}`)
 await tx.execute(sql`UPDATE tako_whatsapp_links SET password_reissue=false WHERE phone=${link.phone} AND restaurant_id=${link.tenant}`)}
/** Account titolare legato a QUESTO numero e QUESTO locale. Mai un account agenzia, mai un altro locale.
 *  Con l'email salvata nel pannello: l'account con quell'email se è il titolare di questo locale, bloccato se l'email è di un altro
 *  account; altrimenti, con `create`, lo crea (utente = email, password a tre parole). Il collegamento passa al titolare (actor_id).
 *  Password (solo con `create`): account nuovo; account esistente mai entrato e mai consegnato (password_delivered_at NULL, nessun
 *  login, nessuna sessione); oppure ricollegamento (password_reissue). Altrimenti riuso senza password.
 *  Senza email (collegamenti di prima del 19/10): chi ha collegato il numero se è il titolare del locale, o il titolare con quel telefono. */
export async function ownerAccount(tx:Exec,link:Link,create:boolean):Promise<OwnerAccount|null>{
 const rows=await tx.execute(sql`SELECT owner_email,password_reissue FROM tako_whatsapp_links WHERE phone=${link.phone} AND restaurant_id=${link.tenant}`),email=ownerEmailSchema(rows[0]?.owner_email),reissue=rows[0]?.password_reissue===true
 if(email){const found=await tx.execute(sql`SELECT u.id,u.restaurant_id,u.role,u.active,u.password_delivered_at,u.last_login_at,EXISTS(SELECT 1 FROM sessions s WHERE s.user_id=u.id) AS has_session FROM users u WHERE lower(u.email)=${email}`)
  if(found.length){const u=found[0]!;if(!(found.length===1&&isOwnerOf(u,link.tenant)))return{blocked:true}
   const id=String(u.id);await adoptLink(tx,link,id)
   if(!create)return{id,username:email,created:false}
   const neverUsed=u.password_delivered_at==null&&u.last_login_at==null&&!u.has_session
   if(reissue||neverUsed){const password=await reissuePassword(tx,id,link.tenant);if(password)return{id,username:email,created:false,password}}
   // Account già in uso (il titolare conosce la sua password): consegnato.
   if(u.password_delivered_at==null)await tx.execute(sql`UPDATE users SET password_delivered_at=now() WHERE id=${id}`)
   return{id,username:email,created:false}}
  if(!create)return null
  const password=simplePassword(),id=randomUUID(),hash=await bcrypt.hash(password,12),phone=normalizeOwnerPhone(link.phone)
  await tx.execute(sql`INSERT INTO users(id,restaurant_id,name,email,password_hash,role,phone,active,email_verified) VALUES(${id},${link.tenant},${await ownerName(tx,link.tenant)},${email},${hash},'owner',${phone},true,false)`)
  await adoptLink(tx,link,id)
  return{id,username:email,created:true,password}}
 const actor=(await tx.execute(sql`SELECT id,restaurant_id,role,active,email FROM users WHERE id=${link.actor}`))[0]
 if(isOwnerOf(actor,link.tenant))return{id:String(actor!.id),username:String(actor!.email),created:false}
 const e164=normalizeOwnerPhone(link.phone);if(!e164)return null
 const byPhone=(await tx.execute(sql`SELECT id,restaurant_id,role,active,email FROM users WHERE restaurant_id=${link.tenant} AND role='owner' AND active=true AND phone IN (${e164},${e164.replace(/^\+39/,'')})`)).filter(u=>isOwnerOf(u,link.tenant))
 return byPhone.length===1?{id:String(byPhone[0]!.id),username:String(byPhone[0]!.email),created:false}:null
}

