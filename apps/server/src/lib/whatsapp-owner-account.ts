// 19/10 (decisione Manuel, rivista lo stesso giorno): account della dashboard per il titolare collegato su WhatsApp.
// Nel pannello «WhatsApp del titolare» si salvano numero ed EMAIL del titolare. Al primo messaggio il bot crea (o ritrova) l'account
// owner del SOLO locale collegato (utente = email, password = tre parole) e manda link + credenziali in chat. Nel DB c'è solo l'hash
// bcrypt; la password in chiaro esiste solo nel messaggio in uscita. Niente gestione password in chat: si recupera dalla pagina di
// accesso (codice via email) o si cambia da dentro la dashboard.
import {randomInt,randomUUID} from 'node:crypto'
import bcrypt from 'bcryptjs'
import {sql} from 'drizzle-orm'
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
export function simplePassword(pick:(n:number)=>number=randomInt):string{const out:string[]=[];while(out.length<3){const w=passwordWords[pick(passwordWords.length)]!;if(!out.includes(w))out.push(w)}return out.join('.')}
export type OwnerAccount={id:string,username:string,created:boolean,password?:string}|{blocked:true}
type Link={phone:string,tenant:string,actor:string}
export const ownerEmailSchema=(raw:unknown)=>{if(typeof raw!=='string')return null;const e=raw.trim().toLowerCase();return e.length<=254&&/^[^\s@<>()",;:]+@[^\s@<>()",;:]+\.[a-z]{2,}$/.test(e)?e:null}
const isOwnerOf=(u:any,tenant:string)=>!!u&&u.restaurant_id===tenant&&u.role==='owner'&&u.active===true&&!isAgencyUser(String(u.id))
/** Account titolare legato a QUESTO numero e QUESTO locale. Mai un account agenzia, mai un altro locale.
 *  Con l'email salvata nel pannello: l'account con quell'email se è il titolare di questo locale (riuso, nessuna password nuova),
 *  bloccato se l'email è di un altro account; altrimenti, con `create`, lo crea (utente = email, password a tre parole).
 *  Senza email (collegamenti di prima del 19/10): chi ha collegato il numero se è il titolare del locale, o il titolare con quel telefono. */
export async function ownerAccount(tx:Exec,link:Link,create:boolean):Promise<OwnerAccount|null>{
 const rows=await tx.execute(sql`SELECT owner_email FROM tako_whatsapp_links WHERE phone=${link.phone} AND restaurant_id=${link.tenant}`),email=ownerEmailSchema(rows[0]?.owner_email)
 if(email){const found=await tx.execute(sql`SELECT id,restaurant_id,role,active FROM users WHERE lower(email)=${email}`)
  if(found.length)return found.length===1&&isOwnerOf(found[0],link.tenant)?{id:String(found[0]!.id),username:email,created:false}:{blocked:true}
  if(!create)return null
  const password=simplePassword(),id=randomUUID(),hash=await bcrypt.hash(password,12),phone=normalizeOwnerPhone(link.phone)
  await tx.execute(sql`INSERT INTO users(id,restaurant_id,name,email,password_hash,role,phone,active,email_verified) VALUES(${id},${link.tenant},${'Titolare'},${email},${hash},'owner',${phone},true,false)`)
  return{id,username:email,created:true,password}}
 const actor=(await tx.execute(sql`SELECT id,restaurant_id,role,active,email FROM users WHERE id=${link.actor}`))[0]
 if(isOwnerOf(actor,link.tenant))return{id:String(actor!.id),username:String(actor!.email),created:false}
 const e164=normalizeOwnerPhone(link.phone);if(!e164)return null
 const byPhone=(await tx.execute(sql`SELECT id,restaurant_id,role,active,email FROM users WHERE restaurant_id=${link.tenant} AND role='owner' AND active=true AND phone IN (${e164},${e164.replace(/^\+39/,'')})`)).filter(u=>isOwnerOf(u,link.tenant))
 return byPhone.length===1?{id:String(byPhone[0]!.id),username:String(byPhone[0]!.email),created:false}:null
}
