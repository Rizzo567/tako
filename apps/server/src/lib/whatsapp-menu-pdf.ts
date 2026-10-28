// 28/10 (richiesta Manuel, decisione «PDF A4»): il titolare chiede in chat «mandami il menu giorno» e Tako allega il PDF di quel Menu,
// generato dal menu PUBBLICATO del momento (lo stesso foglio del pulsante Stampa, senza il PDF fisso caricato a mano).
// Twilio scarica l'allegato da un indirizzo pubblico: il link porta un token firmato (locale, Menu, lingua, scadenza) e nessun dato
// salvato. Il token scade dopo poche ore; il PDF si genera quando Twilio lo scarica.
import {createHmac,timingSafeEqual} from 'node:crypto'
import {Buffer} from 'node:buffer'
import {eq,sql} from 'drizzle-orm'
import type {DB} from '@tako/db'
import {db,restaurants} from '@tako/db'
import {readWorkspace} from './menu-workspace-store.js'
import {workspaceSchema,type Workspace} from './menu-workspace-contract.js'
import {paperMenuIds} from './menu-paper-select.js'
import {withConfiguredPdfRuntimeAssets} from './edge-pdf-runtime-assets.js'
import {documentFilename} from './menu-pdf-documents.js'
import {webOrigin} from './web-runtime.js'

export const MENU_PDF_TTL_MS=6*60*60*1000
const SCOPE='takomenu:whatsapp-menu-pdf:v1'
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
type Claim={tenant:string,menuIds:string[],lang?:string}
const b64=(b:Buffer)=>b.toString('base64url')
const mac=(payload:string,secret:string)=>createHmac('sha256',secret).update(SCOPE+':'+payload).digest()

export function signMenuPdfToken(c:Claim,secret:string,now=Date.now()):string{
 if(!secret||secret.length<16)throw new Error('PDF token secret missing')
 if(!UUID.test(c.tenant)||!c.menuIds.length||c.menuIds.length>8||c.menuIds.some(id=>!UUID.test(id)))throw new Error('Invalid PDF claim')
 const payload=b64(Buffer.from(JSON.stringify({t:c.tenant,m:c.menuIds,...(c.lang?{l:c.lang}:{}),e:now+MENU_PDF_TTL_MS})))
 return payload+'.'+b64(mac(payload,secret))}

export function readMenuPdfToken(token:string,secret:string,now=Date.now()):Claim|null{
 if(!secret||token.length>1200||!/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token))return null
 const [payload,sig]=token.split('.') as [string,string],want=mac(payload,secret),got=Buffer.from(sig,'base64url')
 if(got.length!==want.length||!timingSafeEqual(got,want))return null
 try{const j=JSON.parse(Buffer.from(payload,'base64url').toString('utf8'))
  if(typeof j?.e!=='number'||j.e<now||!UUID.test(String(j.t))||!Array.isArray(j.m)||!j.m.length||j.m.some((id:unknown)=>!UUID.test(String(id))))return null
  return {tenant:String(j.t),menuIds:j.m.map(String),...(typeof j.l==='string'&&/^[a-z]{2}(?:-[A-Z]{2})?$/.test(j.l)?{lang:j.l}:{})}}catch{return null}}

/** Indirizzo pubblico dell'allegato. Il nome del file è quello che WhatsApp mostra («menu-giorno.pdf»); il token sta nella query
 * (i parametri di percorso di Fastify si fermano a 100 caratteri). */
export function menuPdfUrl(token:string,menuName:string){let origin='https://takoitalia.com';try{origin=new URL(webOrigin()).origin}catch{}
 return `${origin}/api/public/whatsapp-pdf/${documentFilename(menuName)}?k=${token}`}

export const menuPdfSecret=()=>process.env.JWT_SECRET||''

type Restaurant={name:string,active:boolean|null,settings:unknown}
const servable=(r:{active?:unknown,settings?:unknown}|undefined)=>{const st=(r?.settings??{}) as {takomenuTrial?:unknown,takomenuRemoved?:unknown};return !!r&&r.active!==false&&st.takomenuTrial!==true&&st.takomenuRemoved!==true}
/** Stesse condizioni della route pubblica: il bot non allega un link che risponderebbe 404. */
export async function chatPdfAvailable(tenant:string,connection:Pick<DB,'execute'>=db):Promise<boolean>{const rows=await connection.execute(sql`SELECT active,settings FROM restaurants WHERE id=${tenant}`);return servable(rows[0] as {active?:unknown,settings?:unknown}|undefined)}
/** PDF del menu pubblicato del momento. null = locale spento/rimosso/in prova, nulla di pubblicato o Menu non più presenti. */
export async function renderChatMenuPdf(c:Claim):Promise<{bytes:Buffer}|null>{
 const [row,restaurant]=await Promise.all([readWorkspace(c.tenant),db.select({name:restaurants.name,active:restaurants.active,settings:restaurants.settings}).from(restaurants).where(eq(restaurants.id,c.tenant)).then(r=>r[0] as Restaurant|undefined)])
 const settings=(restaurant?.settings??{}) as {takomenuTrial?:unknown,takomenuRemoved?:unknown,timezone?:string}
 if(!restaurant||!servable(restaurant)||!row?.published)return null
 const parsed=workspaceSchema.safeParse(row.published),w=(parsed.success?parsed.data:row.published) as Workspace
 const menuIds=c.menuIds.filter(id=>w.menus.some(m=>m.id===id));if(!menuIds.length)return null
 const lang=c.lang&&w.languages.includes(c.lang)?c.lang:w.defaultLanguage,name=restaurant.name??'Menu'
 if(paperMenuIds(w,menuIds)){const {renderPaperPdf}=await import('./menu-paper-pdf.js');return {bytes:await withConfiguredPdfRuntimeAssets(w,menuIds,lang,assets=>renderPaperPdf(w,menuIds,lang,name,c.tenant,assets))}}
 const {renderWorkspacePdf}=await import('./menu-workspace-pdf.js')
 // Il titolare ha chiesto quel Menu: orari ignorati («menu cena» chiesto a mezzogiorno resta pieno), ordine come richiesto.
 return {bytes:await withConfiguredPdfRuntimeAssets(w,menuIds,lang,assets=>renderWorkspacePdf(w,menuIds,lang,name,c.tenant,assets,{timezone:settings.timezone,menuOrder:'given',ignoreSchedules:true}))}}
