import {Buffer} from 'node:buffer'
import {createHash,createHmac,randomUUID,timingSafeEqual} from 'node:crypto'
import {db,restaurants} from '@tako/db'
import {eq} from 'drizzle-orm'
import {verifyGatewayContext} from '../../../../scripts/serverless/gateway-context.mjs'
import {readPublishedCatalog,publicMenuProjection} from './published-menu.js'
import {downloadRemoteImage,imageObjectKey} from './remote-image-store.js'
import {recordMenuEvents} from './menu-workspace-events.js'
import {DurableRateCounter} from './durable-rate-counter.js'
import {postgresCounterExecutor} from './durable-rate-store.js'
import {requireAuth} from '../middleware/auth.js'
import {isAgencyUser} from './agency-access.js'
import {agencyOverviewQuery} from '../routes/agency.js'
import {summarizeAgencyRestaurant} from './agency-overview.js'
import {readWorkspace} from './menu-workspace-store.js'
import {publishDiffBody} from './menu-workspace-read.js'
import {commonMenuLanguages,COMMON_MENU_LANGUAGES} from './menu-workspace-languages.js'
import {foodCatalogs} from './menu-workspace-catalogs.js'
import {readActiveOrders,readRooms,readWaiterCalls,readReservationsForDay,readDashboardStats,readRestaurantMe,readAgencyMe,type ReadResult} from './read-queries.js'

export function visitToken(secret:string,tenant:string,cookie?:string,now=Math.floor(Date.now()/1000)){
 if(cookie&&cookie.length<=4096)try{const [head,body,signature]=cookie.split('.'),header=JSON.parse(Buffer.from(head!,'base64url').toString()),payload=JSON.parse(Buffer.from(body!,'base64url').toString());const expected=createHmac('sha256',secret).update(head+'.'+body).digest(),supplied=Buffer.from(signature!,'base64url');if(header.alg==='HS256'&&expected.length===supplied.length&&timingSafeEqual(expected,supplied)&&payload.kind==='menu_visit'&&payload.restaurantId===tenant&&typeof payload.sid==='string'&&payload.exp>now&&(payload.nbf===undefined||payload.nbf<=now))return {sid:payload.sid}}catch{}
 const sid=randomUUID(),head=Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url'),body=Buffer.from(JSON.stringify({kind:'menu_visit',restaurantId:tenant,sid,iat:now,exp:now+7200})).toString('base64url'),signature=createHmac('sha256',secret).update(head+'.'+body).digest('base64url');return {sid,token:head+'.'+body+'.'+signature}
}
// Letture autenticate servite qui. Ognuna chiama la STESSA funzione della route Fastify
// (lib/read-queries.ts) con lo stesso req.user di requireAuth: risposta identica.
const SHARED_READS:Record<string,(user:any,query:Record<string,string|string[]>,env:NodeJS.ProcessEnv)=>ReadResult|Promise<ReadResult>>={
 '/api/auth/me':user=>({status:200,body:{data:user}}),
 '/api/orders/active':(user,query)=>readActiveOrders(user.restaurantId,query),
 '/api/tables/rooms':user=>readRooms(user.restaurantId),
 '/api/tables/waiter-calls':(user,query)=>readWaiterCalls(user.restaurantId,query),
 '/api/reservations':(user,query)=>readReservationsForDay(user.restaurantId,query),
 '/api/stats/dashboard':(user,query)=>readDashboardStats(user.restaurantId,query),
 '/api/restaurants/me':user=>readRestaurantMe(user.restaurantId),
 '/api/agency/me':(user,_query,env)=>readAgencyMe(user.id,env),
}
export const AUTHENTICATED_READ_PATHS:readonly string[]=['/api/auth/bootstrap','/api/agency/restaurants','/api/menu-workspace','/api/menu-workspace/presentation','/api/menu-workspace/publish/diff',...Object.keys(SHARED_READS)]
/** Come il querystring di Fastify: chiavi ripetute diventano array, nessun prototipo. */
export function fastifyQuery(params:URLSearchParams){const q:Record<string,string|string[]>=Object.create(null);for(const [k,v] of params){const prev=q[k];q[k]=prev===undefined?v:Array.isArray(prev)?[...prev,v]:[prev,v]}return q}
const cookies=(header:string|null)=>Object.fromEntries((header||'').split(';').flatMap(part=>{const at=part.indexOf('=');if(at<0)return [];try{return [[part.slice(0,at).trim(),decodeURIComponent(part.slice(at+1))]]}catch{return []}}))
export function createEdgeReadHandler(env=process.env){
 const publicOrigin=new URL(env.WEB_ORIGIN!).origin
 const counter=new DurableRateCounter(postgresCounterExecutor,env.TAKO_RATE_LIMIT_SECRET!,'fastify:v1:'+createHash('sha256').update('global').digest('hex'))
 return async(request:Request)=>{
  const started=performance.now(),headers=new Headers({'Content-Type':'application/json','Cache-Control':'no-store','Vary':'Cookie, Authorization, Origin','X-Content-Type-Options':'nosniff','X-Takomenu-Read-Lane':'1'})
  const send=(body:unknown,status=200)=>{headers.set('Server-Timing',`read;dur=${(performance.now()-started).toFixed(1)}`);return new Response(request.method==='HEAD'?null:JSON.stringify(body),{status,headers})}
  const context=verifyGatewayContext(request,{secret:env.TAKO_GATEWAY_SECRET,origin:env.WEB_ORIGIN});if(!context)return send({error:{code:'GATEWAY_REQUIRED',message:'Gateway richiesto'}},403)
  if(!['GET','HEAD'].includes(request.method))return send({error:{code:'READ_ONLY',message:'Metodo non consentito'}},405)
  const url=new URL(request.url),path=url.pathname.replace(/^\/(?:functions\/v1\/)?tako-read-candidate/,'').replace(/\/$/,'');const parsed=cookies(request.headers.get('cookie'))
  // Stessa catena del servizio operativo dopo il limite: confine d'origine (webBoundary),
  // requireAuth (stesso req.url per il controllo menu_editor), poi la lettura condivisa.
  const authenticatedRead=async(request:Request,url:URL,path:string,parsed:Record<string,string>):Promise<ReadResult>=>{
   const origin=request.headers.get('origin');if(origin&&origin!==publicOrigin)return {status:403,body:{error:{code:'ORIGIN_REJECTED',message:'Origine della richiesta non autorizzata.'}}}
   const req:any={url:path+url.search,method:request.method==='HEAD'?'GET':request.method,cookies:parsed,headers:Object.fromEntries(request.headers)},reply:any={status:200,sent:false,code(status:number){this.status=status;return this},send(body:unknown){this.sent=true;this.body=body;return this},setCookie(name:string,value:string,options:any){headers.append('Set-Cookie',`${name}=${encodeURIComponent(value)}; Path=${options.path||'/'}; Max-Age=${options.maxAge}; HttpOnly; SameSite=Lax${options.secure?'; Secure':''}`);return this}}
   await requireAuth(req,reply);if(reply.sent)return {status:reply.status,body:reply.body}
   const user=req.user,tenant=user.restaurantId
   const shared=SHARED_READS[path];if(shared)return shared(user,fastifyQuery(url.searchParams),env)
   if(path==='/api/auth/bootstrap'){const [restaurant]=await db.select().from(restaurants).where(eq(restaurants.id,tenant)).limit(1);if(!restaurant)return {status:404,body:{error:{code:'NOT_FOUND',message:'Restaurant not found'}}};return {status:200,body:{data:{user,restaurant:user.role==='menu_editor'?{id:restaurant.id,name:restaurant.name}:restaurant}}}}
   if(path==='/api/agency/restaurants'){if(!isAgencyUser(user.id,env))return {status:403,body:{error:{code:'AGENCY_FORBIDDEN',message:'Accesso riservato a Serie B Agency.'}}};return {status:200,body:{data:(await db.execute(agencyOverviewQuery)).map(summarizeAgencyRestaurant)}}}
   if(!['owner','manager','menu_editor'].includes(user.role))return {status:403,body:{error:{code:'FORBIDDEN',message:'Insufficient permissions'}}}
   // Stesso corpo della route (lib/menu-workspace-read.ts). Workspace mai creato: 501, lo crea l'operativa (ensureWorkspace).
   if(path==='/api/menu-workspace/publish/diff'){const row=await readWorkspace(tenant);if(!row)return {status:501,body:{error:{code:'LEGACY_READ',message:'Usare il servizio operativo'}}};return {status:200,body:publishDiffBody(row)}}
   const [restaurant]=await db.select({name:restaurants.name}).from(restaurants).where(eq(restaurants.id,tenant));const presentation={restaurantName:restaurant?.name??'Menu',foodCatalogs}
   if(path==='/api/menu-workspace/presentation')return {status:200,body:{data:presentation}}
   const workspace=await readWorkspace(tenant);if(!workspace)return {status:501,body:{error:{code:'LEGACY_READ',message:'Usare il servizio operativo'}}}
   return {status:200,body:{data:commonMenuLanguages(workspace.draft),revision:workspace.revision,publishedRevision:workspace.published_revision,presentation}}
  }
  // Stesso contatore durevole del servizio operativo (100/min per IP). Over-limit → 429 senza dati.
  const overLimit=async()=>{const quota=await counter.consume(context.ip,60000);if(quota.current>100){headers.set('Retry-After',String(Math.ceil(quota.ttl/1000)));return true}return false}
  const rateLimited=()=>send({error:{code:'RATE_LIMIT',message:'Troppe richieste. Riprova tra un minuto.'}},429)
  try{
   if(AUTHENTICATED_READ_PATHS.includes(path)){
    // Letture autenticate: il contatore gira IN PARALLELO alla lettura (un round trip in meno).
    // La lettura è solo SELECT (più il refresh rolling della sessione di requireAuth): se
    // oltre soglia si risponde 429 e il risultato viene scartato. Menu pubblico e immagini
    // restano sequenziali: sono anonimi e il limite deve proteggerne il costo.
    const [limited,result]=await Promise.all([overLimit(),authenticatedRead(request,url,path,parsed)])
    return limited?rateLimited():send(result.body,result.status)
   }
   if(await overLimit())return rateLimited()
   const image=path.match(/^\/uploads\/([a-f0-9-]{36})\/([^/]+)$/i);if(image){try{imageObjectKey(image[1]!,image[2]!)}catch{return send(null,404)}const upstream=await downloadRemoteImage(image[1]!,image[2]!);const mime=upstream.headers.get('content-type')?.split(';')[0]||'';if(!upstream.ok||!upstream.body||!['image/jpeg','image/png','image/webp','image/gif'].includes(mime))return send(null,upstream.status===404?404:502);headers.set('Content-Type',mime);headers.set('Cache-Control','public, max-age=31536000, immutable');headers.delete('Vary');headers.set('Server-Timing',`read;dur=${(performance.now()-started).toFixed(1)}`);if(request.method==='HEAD')await upstream.body.cancel();return new Response(request.method==='HEAD'?null:upstream.body,{status:200,headers})}
   const match=path.match(/^\/api\/customer\/restaurant\/([a-f0-9-]{36})\/menu$/i)
   if(match){const tenant=match[1]!,catalog=await readPublishedCatalog(tenant,{catalogOnly:url.searchParams.get('catalogOnly')==='1'});if(!catalog)return send({error:{code:'LEGACY_READ',message:'Usare il servizio operativo'}},501);const published=catalog.workspace,selected=url.searchParams.has('menuId')?published.menus.find(m=>m.id===url.searchParams.get('menuId')):published.menus[0];if(!selected)return send({error:{code:'NOT_FOUND',message:'Nessun menu attivo'}},404);const settings=catalog.restaurant.settings as any||{},requested=url.searchParams.get('lang')||'',lang=(COMMON_MENU_LANGUAGES as readonly string[]).includes(requested)?requested:published.defaultLanguage;const visit=visitToken(env.JWT_SECRET!,tenant,parsed.tako_menu_visit);if(visit.token)headers.append('Set-Cookie',`tako_menu_visit=${visit.token}; Max-Age=7200; Path=/; HttpOnly; Secure; SameSite=Lax`);if(url.searchParams.get('prefetch')!=='1'){/* Statistiche dopo la risposta: non rallentano il menu e non possono interromperlo. */const events=recordMenuEvents(tenant,selected.id,[{kind:'scan',lang:''},{kind:'language',lang}],visit.sid,String(settings.timezone??'Europe/Rome')).catch(()=>{});const runtime=(globalThis as any).EdgeRuntime;if(typeof runtime?.waitUntil==='function')runtime.waitUntil(events);else await events}return send({data:publicMenuProjection(selected,lang,published.defaultLanguage),menus:published.menus.map(m=>({id:m.id,type:m.type,name:m.translations[lang]?.name||m.name})),design:published.design,foodTranslations:published.foodTranslations,foodCatalogs,languages:[...COMMON_MENU_LANGUAGES],defaultLanguage:published.defaultLanguage,features:{restaurantName:catalog.restaurant.name,reservationsEnabled:settings.reservationsEnabled??false,reviewUrl:settings.reviewRequestEnabled?settings.reviewUrl??'':'',customerOrderingEnabled:settings.customerOrderingEnabled!==false,coverCharge:settings.coverChargeEnabled?Number(settings.coverCharge)||0:0}})}
   return send({error:{code:'LEGACY_READ',message:'Usare il servizio operativo'}},501)
  }catch{return send({error:{code:'READ_UNAVAILABLE',message:'Servizio temporaneamente non disponibile'}},503)}
 }
}
