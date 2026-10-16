import type {FastifyInstance} from 'fastify'
import {db,type DB} from '@tako/db'
import {sql} from 'drizzle-orm'
import {createHash,randomBytes} from 'node:crypto'
import {requireRole} from '../middleware/auth.js'
import {isAgencyUser} from '../lib/agency-access.js'
import {readWorkspace,mutateWorkspace} from '../lib/menu-workspace-store.js'
import {workspaceSchema,type Workspace} from '../lib/menu-workspace-contract.js'
import {Buffer} from 'node:buffer'
import {priceChoiceText,effectiveMenuActions,mergeMenuActions,appliedMenuText,groqPendingMenuPlan,validatePendingMenuPlan,validateMenuPlan,groqMenuPlan,groqDishPick,validateDishPick,dishMatches,itemLabel,photoProblem,downscaleSourcePixels,applyActions,planText,welcomeText,safe,localDate,capabilityText,readText,GroqBusy,type GroqOptions,type UsageEvent,downloadTwilioMedia,transcribeAudio,sendWhatsApp,proposalText,type MenuRef,type SectionRef,type MenuAction,type MenuPlan} from '../lib/twilio-menu-ai.js'
import {copy,helpWords,fill} from '../lib/twilio-menu-copy.js'
import {parseIntent,findDishes,preselect,candidatesFor,resolveChoice,capabilityFromText,isThanks,compoundIntents,looksLikeQuestion,wantsCreateText,wantsSpecialText,type Intent} from '../lib/twilio-menu-nlu.js'
import {validTwilioSignature,shouldHandleInTako,replyIntent,forwardTwilioWebhook,parseMenuCommand,normalizeMenuText,twiml,nextMessage,whatsappAudioType,type MenuCommand} from '../lib/twilio-menu-command.js'
import {reportFailure,inBackground,type FailureKind} from '../lib/twilio-menu-alerts.js'
import {normalizeOwnerPhone,whatsappAddress} from '../lib/whatsapp-phone.js'
import {parseSalesText,salesTurn,salesActionProblem,type SalesTemplate} from '../lib/twilio-menu-sales.js'
import {businessDate} from '../lib/menu-sales.js'
const menusmartWebhook='https://mtdguvbpdmekgzaemqoy.supabase.co/functions/v1/whatsapp-webhook'
const digest=(s:string)=>createHash('sha256').update(s).digest('hex')
async function permitted(tx:Pick<DB,'execute'>,actor:string,tenant:string){const rows=await tx.execute(sql`SELECT u.id,u.restaurant_id,u.role,r.active FROM users u JOIN restaurants r ON r.id=${tenant} WHERE u.id=${actor} AND u.active=true`);const u=rows[0];if(!u||!u.active)return false;if(isAgencyUser(actor))return true;if(u.restaurant_id===tenant&&u.role==='owner')return true;const membership=await tx.execute(sql`SELECT role FROM web_location_memberships WHERE user_id=${actor} AND restaurant_id=${tenant}`);return membership[0]?.role==='owner'}
const sent='\u0001'
type Ctx={phone:string,tenant:string,actor:string,pending?:boolean};type Tx=Pick<DB,'execute'>;type Photo={mediaUrl:string,mediaType:string,url?:string};type ChoiceAction={kind:'price',price:number}|{kind:'available'|'hidden'|'featured',value:boolean}|{kind:'description',text:string}|{kind:'tag',tag:string,value:boolean}|SalesTemplate;type Choice={kind:'choose',action:ChoiceAction,options:string[]};type Turn=string|{llm:true,photo?:Photo}|{upload:Extract<MenuAction,{kind:'image'}>[]}
const lock=(tx:Tx,phone:string)=>tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${phone},0))`)
const reserve=(tx:Tx,sid:string)=>tx.execute(sql`INSERT INTO tako_whatsapp_messages(sid,response) VALUES(${sid},${sent}) ON CONFLICT DO NOTHING`)
const propose=(tx:Tx,ctx:Ctx,revision:number,command:unknown)=>tx.execute(sql`INSERT INTO tako_whatsapp_proposals(phone,restaurant_id,actor_id,revision,command,expires_at) VALUES(${ctx.phone},${ctx.tenant},${ctx.actor},${revision},${JSON.stringify(command)}::jsonb,now()+interval '10 minutes') ON CONFLICT(phone) DO UPDATE SET restaurant_id=EXCLUDED.restaurant_id,actor_id=EXCLUDED.actor_id,revision=EXCLUDED.revision,command=EXCLUDED.command,expires_at=EXCLUDED.expires_at`)
// activated_at NULL = pre-collegamento dalla dashboard: il numero è già di Takomenu (mai inoltrato a MenuSmart) e il primo messaggio lo attiva.
async function linkedContext(tx:Tx,phone:string):Promise<Ctx|null>{const links=await tx.execute(sql`SELECT restaurant_id,actor_id,activated_at FROM tako_whatsapp_links WHERE phone=${phone}`),link=links[0];return link&&await permitted(tx,String(link.actor_id),String(link.restaurant_id))?{phone,tenant:String(link.restaurant_id),actor:String(link.actor_id),pending:link.activated_at==null}:null}
async function welcomeFor(tx:Tx,tenant:string){const restaurant=await tx.execute(sql`SELECT name FROM restaurants WHERE id=${tenant}`),current=await readWorkspace(tenant,tx),catalog=current?catalogOf(workspaceSchema.parse(current.draft)):{refs:[],sections:[]};return welcomeText(String(restaurant[0]?.name),catalog.refs,catalog.sections)}
// Guasto simulato per la verifica dal vivo: SOLO questo numero finto (+39 000…, non assegnabile) collegato al locale QA, con questa frase esatta.
const testFaultPhone='whatsapp:+390000000099',qaTenant='26050ecd-2e55-4057-a4c5-bff2b449cd47';class TestFault extends Error{}
const catalogOf=(w:Workspace)=>({refs:w.menus.flatMap(m=>m.sections.flatMap(s=>s.items.map(i=>({id:i.id,name:i.name,price:i.price,available:i.available,hidden:i.hidden,menu:m.name,section:s.name,sectionId:s.id,hasImage:!!i.imageUrl,featured:i.featured,tags:i.tags} as MenuRef)))),sections:w.menus.flatMap(m=>m.sections.map(s=>({id:s.id,name:s.name,menu:m.name} as SectionRef)))})
const shown=(target:string)=>target.replace(/^(il|lo|la|i|gli|le|l|un|una|uno)\s+/i,'').slice(0,60)
const bold=(names:string[])=>names.map(n=>'*'+safe(n)+'*').join(', ')
function storedActions(command:any,refs:MenuRef[],sections:SectionRef[]):MenuAction[]|null{
 if(command?.kind==='batch'&&Array.isArray(command.actions))return command.actions.every((a:any)=>a.kind==='special'||(a.kind==='create'?sections.some(s=>s.id===a.sectionId):refs.some(r=>r.id===a.id)))?command.actions:null
 const legacy=command as MenuCommand|null,matches=legacy?refs.filter(r=>normalizeMenuText(r.name)===normalizeMenuText(legacy.name)):[];if(!legacy||matches.length!==1)return null;return[legacy.kind==='price'?{kind:'price',id:matches[0]!.id,price:legacy.price}:{kind:legacy.kind,id:matches[0]!.id,value:legacy.value}]
}
export async function menuTurn(tx:Tx,ctx:Ctx,text:string,opts:{planned?:{revision:number,plan:MenuPlan,proposalRevision?:string},voice?:boolean,isExpired?:()=>boolean,uploads?:Map<string,string>}={}):Promise<Turn>{
 if(opts.isExpired?.())throw new Error('WhatsApp turn expired');
 const {phone,tenant,actor}=ctx,{planned,uploads}=opts,normalized=normalizeMenuText(text).replace(/[^a-z0-9]+/g,' ').trim(),intent=replyIntent(text),open=intent&&!['annulla','no','conferma','si','ok'].includes(normalized)?(await tx.execute(sql`SELECT 1 FROM tako_whatsapp_proposals WHERE phone=${phone} AND expires_at>now()`)).length>0:true,reply=open?intent:null;
 if(reply==='cancel'){const waiting=await tx.execute(sql`SELECT 1 FROM tako_whatsapp_proposals WHERE phone=${phone} AND expires_at>now()`);if(!waiting.length)return copy.nothingToCancel;await tx.execute(sql`DELETE FROM tako_whatsapp_proposals WHERE phone=${phone}`);return copy.cancelled}if(helpWords.includes(normalized))return copy.help;
 const row=await readWorkspace(tenant,tx);if(!row||!row.published)return copy.notPublished;if(row.revision!==row.published_revision)return copy.dashboardPending;const workspace=workspaceSchema.parse(row.draft),{refs,sections}=catalogOf(workspace);
 const priceChoice=priceChoiceText(text,refs);if(priceChoice)return priceChoice;
 const proposals=await tx.execute(sql`SELECT command,revision FROM tako_whatsapp_proposals WHERE phone=${phone} AND actor_id=${actor} AND restaurant_id=${tenant} AND expires_at>now() FOR UPDATE`),proposal=proposals[0],pending=(proposal?.command as any)?.kind==='photo'?proposal!.command as Photo&{kind:'photo'}:null,choice=(proposal?.command as any)?.kind==='choose'?proposal!.command as Choice:null;
 if(reply==='confirm'){if(!proposal)return copy.nothingToConfirm;if(pending)return copy.photoNameFirst;if(choice)return copy.chooseFirst;if((proposal.command as any)?.requiresTypedOk&&(opts.voice||normalized!=='ok'))return copy.typedOk;const actions=Number(proposal.revision)===row.revision?storedActions(proposal.command,refs,sections):null;if(!actions){await tx.execute(sql`DELETE FROM tako_whatsapp_proposals WHERE phone=${phone}`);return copy.menuChanged}
  const photos=actions.filter((a):a is Extract<MenuAction,{kind:'image'}>=>a.kind==='image'),ready=new Map<string,string>([...photos.flatMap(a=>a.url&&storedUpload(tenant,a.url)?[[a.id,a.url] as [string,string]]:[]),...(uploads??[])]);if(photos.some(a=>!ready.has(a.id)))return{upload:photos.filter(a=>!ready.has(a.id))}
  const restaurant=await tx.execute(sql`SELECT settings FROM restaurants WHERE id=${tenant}`),names=applyActions(workspace,actions,{uploads:ready,timezone:String((restaurant[0]?.settings as any)?.timezone??'Europe/Rome')}),next=workspaceSchema.parse(workspace)
  if(opts.isExpired?.())throw new Error('WhatsApp turn expired');const saved=await mutateWorkspace(tenant,actor,row.revision,next,false,'WhatsApp: bozza confermata',tx as unknown as DB);if(opts.isExpired?.())throw new Error('WhatsApp turn expired');await mutateWorkspace(tenant,actor,saved.revision,next,true,'WhatsApp: pubblicazione confermata',tx as unknown as DB);if(opts.isExpired?.())throw new Error('WhatsApp turn expired');await tx.execute(sql`DELETE FROM tako_whatsapp_proposals WHERE phone=${phone}`);return appliedMenuText(actions,refs,sections)}
 const batch=proposal&&(proposal.command as any)?.kind==='batch'?storedActions(proposal.command,refs,sections):null;
 if(batch&&Number(proposal!.revision)!==row.revision){await tx.execute(sql`DELETE FROM tako_whatsapp_proposals WHERE phone=${phone}`);return copy.menuChanged}
 if(batch&&!planned)return{llm:true};
 if(!planned&&!pending&&!choice&&(/(?<!\d),(?!\d)|[;\n]|\s+e\s+/i.test(text)))return{llm:true};
 let actions:MenuAction[];if(planned){if(planned.revision!==row.revision||planned.proposalRevision!==undefined&&planned.proposalRevision!==JSON.stringify(proposal?.command??null))return copy.menuChanged;const plan=planned.plan;if(plan.type!=='change')return planText(plan,refs,sections);if(!storedActions({kind:'batch',actions:plan.actions},refs,sections))return copy.notUnderstood;actions=batch?mergeMenuActions(batch,plan.actions,plan.remove):plan.actions}
 else{let picked:MenuAction[]|null=null;if(choice){const target=resolveChoice(text,choice.options.map(id=>refs.find(r=>r.id===id)).filter((r):r is MenuRef=>!!r));if(target)picked=[{...choice.action,id:target.id} as MenuAction]}
  const command=parseMenuCommand(text)
  if(!picked&&!command&&pending){const matches=dishMatches(text,refs);if(matches.length!==1)return matches.length>1?fill(copy.sameName,{opzioni:bold(matches.map(r=>itemLabel(r,refs))),esempio:itemLabel(matches[0]!,refs)}):{llm:true,photo:{mediaUrl:pending.mediaUrl,mediaType:pending.mediaType,...(pending.url?{url:pending.url}:{})}};picked=[{kind:'image',id:matches[0]!.id,mediaUrl:pending.mediaUrl,mediaType:pending.mediaType,...(pending.url?{url:pending.url}:{})}]}
  if(!picked){if(isThanks(text))return copy.thanks
   // F3+F4: promo e scarsità prima di parseIntent («togli la promo…» non è «nascondi»).
   if(!command&&parseSalesText(text)){const settings=await tx.execute(sql`SELECT settings FROM restaurants WHERE id=${tenant}`),sale=salesTurn(text,workspace,refs,businessDate((settings[0]?.settings as any)?.timezone));if(sale&&'reply' in sale)return sale.reply;if(sale&&'choose' in sale){await propose(tx,ctx,row.revision,{kind:'choose',action:sale.choose.template,options:sale.choose.options.map(r=>r.id)});return fill(copy.choose,{opzioni:sale.choose.options.map((r,i)=>`${i+1}. *${itemLabel(r,refs)}*`).join('\n')})}if(sale)picked=sale.actions}
  }
  if(!picked){const capability=capabilityFromText(text);if(capability)return capabilityText(capability)
   const intent:Intent|null=command?(command.kind==='price'?{kind:'price',target:command.name,price:command.price}:{kind:command.kind,target:command.name,value:command.value}):parseIntent(text)
   if(!intent){const parts=compoundIntents(text,refs);if(!parts)return{llm:true};picked=parts.map(({intent:i,ref})=>(i.kind==='price'?{kind:'price',id:ref.id,price:i.price}:i.kind==='description'?{kind:'description',id:ref.id,text:i.text}:i.kind==='tag'?{kind:'tag',id:ref.id,tag:i.tag,value:true}:{kind:i.kind,id:ref.id,value:i.value}) as MenuAction)}
   else{
   if(intent.kind==='read')return readText({type:'read',read:intent.read},refs);if(intent.kind==='capability')return capabilityText(intent.ids)
   const matches=command?refs.filter(r=>normalizeMenuText(r.name)===normalizeMenuText(intent.target)):[];const found=matches.length===1?matches:findDishes(intent.target,refs)
   if(intent.kind==='ask')return found.length?readText({type:'read',read:'items',ids:found.slice(0,6).map(r=>r.id)},refs):fill(copy.notFoundNamed,{nome:shown(intent.target)})
   if(!found.length)return preselect(text,refs).length&&!command?{llm:true}:fill(copy.notFoundNamed,{nome:shown(intent.target)})
   const template:ChoiceAction=intent.kind==='price'?{kind:'price',price:intent.price}:intent.kind==='description'?{kind:'description',text:intent.text}:intent.kind==='tag'?{kind:'tag',tag:intent.tag,value:true}:{kind:intent.kind,value:intent.value}
   if(found.length>1){const options=found.slice(0,8);await propose(tx,ctx,row.revision,{kind:'choose',action:template,options:options.map(r=>r.id)});return fill(copy.choose,{opzioni:options.map((r,i)=>`${i+1}. *${itemLabel(r,refs)}*`).join('\n')})}
   picked=[{...template,id:found[0]!.id} as MenuAction]}}
  actions=picked}
 {const problem=salesActionProblem(actions,workspace);if(problem)return problem}
 actions=effectiveMenuActions(actions,workspace);
 if(!actions.length){if(batch)await tx.execute(sql`DELETE FROM tako_whatsapp_proposals WHERE phone=${phone}`);return batch?copy.pendingEmpty:copy.noChanges}
 const needsApproval=!!batch||actions.length>3;
 if(needsApproval){await propose(tx,ctx,row.revision,{kind:'batch',actions,requiresTypedOk:true});const restaurant=await tx.execute(sql`SELECT name FROM restaurants WHERE id=${tenant}`);return proposalText(String(restaurant[0]?.name),actions,refs,sections)}
 const photos=actions.filter((a):a is Extract<MenuAction,{kind:'image'}>=>a.kind==='image'),ready=new Map<string,string>([...photos.flatMap(a=>a.url&&storedUpload(tenant,a.url)?[[a.id,a.url] as [string,string]]:[]),...(uploads??[])]);
 if(photos.some(a=>!ready.has(a.id))){await propose(tx,ctx,row.revision,{kind:'batch',actions,autoApply:true});return{upload:photos.filter(a=>!ready.has(a.id))}}
 const restaurant=await tx.execute(sql`SELECT settings FROM restaurants WHERE id=${tenant}`);applyActions(workspace,actions,{uploads:ready,timezone:String((restaurant[0]?.settings as any)?.timezone??'Europe/Rome')});const next=workspaceSchema.parse(workspace);
 if(opts.isExpired?.())throw new Error('WhatsApp turn expired');const saved=await mutateWorkspace(tenant,actor,row.revision,next,false,'WhatsApp: aggiornamento automatico',tx as unknown as DB);if(opts.isExpired?.())throw new Error('WhatsApp turn expired');await mutateWorkspace(tenant,actor,saved.revision,next,true,'WhatsApp: pubblicazione automatica',tx as unknown as DB);if(opts.isExpired?.())throw new Error('WhatsApp turn expired');await tx.execute(sql`DELETE FROM tako_whatsapp_proposals WHERE phone=${phone}`);return appliedMenuText(actions,refs,sections)
}
const turnFor=(ctx:Ctx,text:string,opts?:Parameters<typeof menuTurn>[3])=>db.transaction(async tx=>{if(opts?.isExpired?.())throw new Error('WhatsApp turn expired');await lock(tx,ctx.phone);const live=await linkedContext(tx,ctx.phone);const result=live?await menuTurn(tx,live,text,opts):'';if(opts?.isExpired?.())throw new Error('WhatsApp turn expired');return result})
type Budget={expired:boolean,failed?:boolean}
// Watchdog: ogni job in background risponde sempre, anche se un passo si blocca (codec, rete, DB).
const jobTimeoutMs=()=>Number(process.env.TAKO_WHATSAPP_JOB_TIMEOUT_MS)||90_000,photoTimeoutMs=()=>Number(process.env.TAKO_WHATSAPP_PHOTO_TIMEOUT_MS)||40_000
function withTimeout<T>(work:Promise<T>,ms:number,fallback:T):Promise<T>{let timer:ReturnType<typeof setTimeout>|undefined;return Promise.race([work,new Promise<T>(resolve=>{timer=setTimeout(()=>resolve(fallback),ms)})]).finally(()=>clearTimeout(timer))}
const storedUpload=(tenant:string,url:string)=>url.startsWith(`/uploads/${tenant}/`)&&/^[A-Za-z0-9_-]{16}\.(jpg|png|webp)$/.test(url.slice(`/uploads/${tenant}/`.length))
/** Scarica (se serve), riduce i JPEG oltre 2 MP e salva nella galleria del locale: stessa pipeline della dashboard. */
async function prepareUpload(tenant:string,source:{mediaUrl:string}|{bytes:Uint8Array,type:string}):Promise<{url:string}|{error:string}>{
 const work=(async():Promise<{url:string}|{error:string}>=>{const {saveImageBuffer,downscaleOversizedImage}=await import('../lib/image-store.js')
  let media:{bytes:Uint8Array,type:string};try{media='bytes' in source?source:await downloadTwilioMedia(source.mediaUrl,process.env.TWILIO_ACCOUNT_SID||'',process.env.TWILIO_AUTH_TOKEN||'')}catch{return{error:'foto non più scaricabile da WhatsApp'}}
  const problem=photoProblem(media.bytes,media.type);if(problem)return{error:problem.split('\n')[0]!.replace(/\.$/,'')}
  let bytes:Buffer;try{bytes=await downscaleOversizedImage(Buffer.from(media.bytes),downscaleSourcePixels)}catch{return{error:'foto troppo grande da elaborare'}}
  if(!bytes.length)return{error:'foto troppo grande da elaborare'};const saved=await saveImageBuffer(tenant,bytes);return 'url' in saved?{url:saved.url}:{error:saved.error}})().catch(()=>({error:'elaborazione della foto non riuscita'}))
 return withTimeout(work,photoTimeoutMs(),{error:'elaborazione della foto troppo lenta'})
}
const photoRef=(command:any,mediaUrl:string)=>command?.kind==='photo'&&command.mediaUrl===mediaUrl||command?.kind==='batch'&&Array.isArray(command.actions)&&command.actions.some((a:any)=>a?.kind==='image'&&a.mediaUrl===mediaUrl)
const withUrl=(command:any,mediaUrl:string,url:string)=>command.kind==='photo'?{...command,url}:{...command,actions:command.actions.map((a:any)=>a?.kind==='image'&&a.mediaUrl===mediaUrl?{...a,url}:a)}
/** Foto in proposta: elaborata e salvata SUBITO (worker senza pubblicazione), la CONFERMA poi pubblica e basta.
 *  Codec WASM e pubblicazione nello stesso worker edge superavano i limiti del runtime (14/10, Victoria): mai più insieme. */
async function attachPhoto(ctx:Ctx,media:{mediaUrl:string,bytes:Uint8Array,type:string},budget:Budget):Promise<string|null>{
 const open=await db.execute(sql`SELECT command FROM tako_whatsapp_proposals WHERE phone=${ctx.phone} AND expires_at>now()`);if(!photoRef(open[0]?.command,media.mediaUrl))return null
 const saved=await prepareUpload(ctx.tenant,{bytes:media.bytes,type:media.type});if(budget.expired)return null
 return db.transaction(async tx=>{await lock(tx,ctx.phone);const rows=await tx.execute(sql`SELECT command FROM tako_whatsapp_proposals WHERE phone=${ctx.phone} AND expires_at>now() FOR UPDATE`),command=rows[0]?.command;if(!photoRef(command,media.mediaUrl))return null
  if('error' in saved){await tx.execute(sql`DELETE FROM tako_whatsapp_proposals WHERE phone=${ctx.phone}`);return fill(copy.photoPrepareFailed,{motivo:saved.error.replace(/\.$/,'').toLowerCase()})}
  await tx.execute(sql`UPDATE tako_whatsapp_proposals SET command=${JSON.stringify(withUrl(command,media.mediaUrl,saved.url))}::jsonb WHERE phone=${ctx.phone}`);return null})
}
export async function resolveTurn(ctx:Ctx,text:string,turn:Exclude<Turn,string>,key:string,ai:GroqOptions={},budget:Budget={expired:false}):Promise<string>{
 if('upload' in turn){const uploads=new Map<string,string>()
  for(const a of turn.upload){const saved=await prepareUpload(ctx.tenant,{mediaUrl:a.mediaUrl})
   if('error' in saved)return fill(copy.photoUploadFailed,{motivo:saved.error.replace(/\.$/,'').toLowerCase()});uploads.set(a.id,saved.url)}
  if(budget.expired)return ''
  try{const done=await turnFor(ctx,'conferma',{uploads,isExpired:()=>budget.expired});return typeof done==='string'?done:copy.failed}catch{return copy.photoPublishFailed}}
 if(!key)return copy.noAi;const row=await readWorkspace(ctx.tenant);if(!row)throw new Error('Workspace missing');const {refs,sections}=catalogOf(workspaceSchema.parse(row.draft))
 if(turn.photo){const candidates=candidatesFor(text,refs);if(!candidates.length)return fill(copy.photoNotFound,{nome:text.slice(0,80)});const pick=validateDishPick((await groqDishPick(text,candidates,key,[],ai)).content,refs);if(pick.type==='clarify')return pick.ids.length?fill(copy.photoWhich,{opzioni:bold(pick.ids.map(id=>itemLabel(refs.find(r=>r.id===id)!,refs)))}):fill(copy.photoNotFound,{nome:text.slice(0,80)})
  if(budget.expired)return '';const done=await turnFor(ctx,text,{isExpired:()=>budget.expired,planned:{revision:row.revision,plan:{type:'change',actions:[{kind:'image',id:pick.id,...turn.photo}]}}});return typeof done==='string'?done:'upload' in done?await resolveTurn(ctx,text,done,key,ai,budget):copy.failed}
 const pendingRows=await db.execute(sql`SELECT command,revision FROM tako_whatsapp_proposals WHERE phone=${ctx.phone} AND actor_id=${ctx.actor} AND restaurant_id=${ctx.tenant} AND expires_at>now()`),pendingCommand=pendingRows[0]?.command,pending=storedActions(pendingCommand,refs,sections);
 // Reject oversize requests explicitly rather than applying a truncated transcript/catalog.
 if(text.length>30000||refs.length>1500)return 'La richiesta è *troppo lunga*. Non ho cambiato nulla. Dividila in più messaggi.';
 const candidates=refs,raw=pending?validatePendingMenuPlan((await groqPendingMenuPlan(text,refs,key,sections,pending,ai)).content,refs,sections,text,pending):validateMenuPlan((await groqMenuPlan(text,candidates,key,wantsCreateText(text)?sections:[],ai)).content,refs,{sections,message:text}),plan:MenuPlan=!candidates.length&&raw.type==='capability'&&!raw.ids.includes('all')&&!looksLikeQuestion(text)?{type:'clarify',ids:[]}:raw;if(budget.expired)return '';const done=await turnFor(ctx,text,{isExpired:()=>budget.expired,planned:{revision:row.revision,plan,proposalRevision:JSON.stringify(pendingCommand??null)}});return typeof done==='string'?done:'upload' in done?await resolveTurn(ctx,text,done,key,ai,budget):copy.notUnderstood
}
// Contatore Groq per giorno (Europe/Rome) e modello; avviso una volta al giorno oltre l'80% di richieste o token/audio.
export const groqLimits:Record<string,{rpd:number,tpd?:number,asd?:number}>={'openai/gpt-oss-120b':{rpd:1000,tpd:200000},'openai/gpt-oss-20b':{rpd:1000,tpd:200000},'whisper-large-v3-turbo':{rpd:2000,asd:28800}}
const owner=process.env.TAKO_WHATSAPP_USAGE_PHONE||process.env.TAKO_WHATSAPP_ALERT_PHONE||''
export async function recordUsage(e:UsageEvent){try{
 const day=localDate('Europe/Rome').date,rows=await db.execute(sql`INSERT INTO tako_whatsapp_ai_usage(day,model,requests,prompt_tokens,completion_tokens,rate_limited,audio_seconds) VALUES(${day},${e.model},${e.limited?0:1},${e.prompt},${e.completion},${e.limited?1:0},${e.audioSeconds??0}) ON CONFLICT(day,model) DO UPDATE SET requests=tako_whatsapp_ai_usage.requests+EXCLUDED.requests,prompt_tokens=tako_whatsapp_ai_usage.prompt_tokens+EXCLUDED.prompt_tokens,completion_tokens=tako_whatsapp_ai_usage.completion_tokens+EXCLUDED.completion_tokens,rate_limited=tako_whatsapp_ai_usage.rate_limited+EXCLUDED.rate_limited,audio_seconds=tako_whatsapp_ai_usage.audio_seconds+EXCLUDED.audio_seconds RETURNING requests,prompt_tokens,completion_tokens,audio_seconds,warned_at`)
 const row=rows[0],limit=groqLimits[e.model];if(!owner||!row||!limit||row.warned_at)return;const used=[[Number(row.requests)/limit.rpd,`${row.requests}/${limit.rpd} richieste`],...(limit.tpd?[[(Number(row.prompt_tokens)+Number(row.completion_tokens))/limit.tpd,`${Number(row.prompt_tokens)+Number(row.completion_tokens)}/${limit.tpd} token`]]:[]),...(limit.asd?[[Number(row.audio_seconds)/limit.asd,`${Math.round(Number(row.audio_seconds))}/${limit.asd} s audio`]]:[])] as [number,string][]
 const worst=used.sort((a,b)=>b[0]-a[0])[0]!;if(worst[0]<0.8)return
 const claimed=await db.execute(sql`UPDATE tako_whatsapp_ai_usage SET warned_at=now() WHERE day=${day} AND model=${e.model} AND warned_at IS NULL RETURNING model`);if(!claimed.length)return
 const text=fill(copy.usageWarning,{modello:e.model,percento:Math.round(worst[0]*100),uso:worst[1]});console.warn(JSON.stringify({event:'groq_usage_warning',model:e.model,day,ratio:Math.round(worst[0]*100)}))
 const linked=await db.execute(sql`SELECT 1 FROM tako_whatsapp_links WHERE phone=${owner}`);if(linked.length)await sendWhatsApp(process.env.TWILIO_ACCOUNT_SID||'',process.env.TWILIO_AUTH_TOKEN||'',process.env.TWILIO_WHATSAPP_NUMBER||'',owner,text)
}catch(error){console.error(JSON.stringify({event:'groq_usage_record_failed',error:error instanceof Error?error.message.slice(0,80):'Error'}));await reportFailure({kind:'usage_record_failed',detail:error instanceof Error?error.message:'Error'})}}
async function runJob(kind:'audio'|'text'|'image',ctx:Ctx,sid:string,body:string,form:Record<string,string>){
 const budget:Budget={expired:false};let timer:ReturnType<typeof setTimeout>|undefined
 const timeout=new Promise<string>(resolve=>{timer=setTimeout(()=>{budget.expired=true;resolve(kind==='image'?copy.photoTimeout:copy.jobTimeout)},jobTimeoutMs())})
 const message=await Promise.race([jobMessage(kind,ctx,body,form,budget).catch(()=>{budget.failed=true;return kind==='image'?copy.photoDownload:copy.failed}),timeout]).finally(()=>clearTimeout(timer))
 const problem:FailureKind|null=budget.expired?'job_timeout':budget.failed?'job_failed':null
 if(!message){if(problem)await reportFailure({kind:problem,tenant:ctx.tenant,phone:ctx.phone,detail:kind});return}const accountSid=process.env.TWILIO_ACCOUNT_SID||'',token=process.env.TWILIO_AUTH_TOKEN||'',from=process.env.TWILIO_WHATSAPP_NUMBER||''
 try{await sendWhatsApp(accountSid,token,from,ctx.phone,message)}catch{await new Promise(r=>setTimeout(r,1500));try{await sendWhatsApp(accountSid,token,from,ctx.phone,message)}catch(error){await reportFailure({kind:'send_failed',tenant:ctx.tenant,phone:ctx.phone,detail:error instanceof Error?error.message:'Error'});return}}
 await db.execute(sql`UPDATE tako_whatsapp_messages SET response=${sent+message} WHERE sid=${sid}`)
 if(problem)await reportFailure({kind:problem,tenant:ctx.tenant,phone:ctx.phone,detail:kind})
}
async function jobMessage(kind:'audio'|'text'|'image',ctx:Ctx,body:string,form:Record<string,string>,budget:Budget):Promise<string>{
 const key=process.env.GROQ_API_KEY||'',accountSid=process.env.TWILIO_ACCOUNT_SID||'',token=process.env.TWILIO_AUTH_TOKEN||'';let text=body,prefix='',response:string
 const ai:GroqOptions={meter:recordUsage,onWait:()=>sendWhatsApp(accountSid,token,process.env.TWILIO_WHATSAPP_NUMBER||'',ctx.phone,copy.wait).catch(()=>{})}
 try{if(kind==='image'){if(Number(form.NumMedia)>1)prefix=copy.photoFirstOnly;const media=await downloadTwilioMedia(form.MediaUrl0||'',accountSid,token),problem=photoProblem(media.bytes,media.type||form.MediaContentType0||'');const photo={mediaUrl:form.MediaUrl0||'',mediaType:media.type}
   if(problem)response=problem;else{const turn=await db.transaction(async tx=>{await lock(tx,ctx.phone);const live=await linkedContext(tx,ctx.phone);if(!live)return '';await propose(tx,live,0,{kind:'photo',...photo});return text?menuTurn(tx,live,text,{isExpired:()=>budget.expired}):copy.photoAsk});response=typeof turn==='string'?turn:await resolveTurn(ctx,text,turn,key,ai,budget);if(response&&!budget.expired)response=await attachPhoto(ctx,{...photo,bytes:media.bytes,type:media.type},budget).catch(()=>null)??response}}
  else{if(kind==='audio'){if(!key)throw new Error('AI not configured');const media=await downloadTwilioMedia(form.MediaUrl0||'',accountSid,token);text=await transcribeAudio(media.bytes,/^audio\//i.test(media.type)?media.type:whatsappAudioType(form.MediaContentType0,form.Body)||media.type,key,ai)}
   if(kind==='audio'&&!text)response=copy.voiceEmpty;else{if(kind==='audio'){
    prefix='';
    if(process.env.TAKO_WHATSAPP_ONBOARDING_ENABLED==='1'&&!budget.expired){
     const {onboardingTransport,queueOnboardingChat}=await import('../lib/onboarding-chat.js');const agency=await onboardingTransport(ctx.phone,text);
     if(agency){await queueOnboardingChat(agency.actor,ctx.phone,form.MessageSid!,text,{...form,OnboardingVoice:'1',NumMedia:'0'});return ''}
    }
   }if(budget.expired)return '';const turn=await turnFor(ctx,text,{voice:kind==='audio',isExpired:()=>budget.expired});response=typeof turn==='string'?turn:await resolveTurn(ctx,text,turn,key,ai,budget)}}
 }catch(error){if(!(error instanceof GroqBusy))budget.failed=true;response=error instanceof GroqBusy?copy.busy:kind==='audio'&&!prefix?copy.voiceFailed:kind==='image'?copy.photoDownload:copy.failed}
 return response?prefix+response:''
}
export async function twilioMenuRoutes(app:FastifyInstance){
 app.get('/menu-workspace/whatsapp',{preHandler:requireRole('owner')},async req=>{const rows=await db.execute(sql`SELECT phone FROM tako_whatsapp_links WHERE restaurant_id=${req.user.restaurantId} AND actor_id=${req.user.id}`);return{data:{configured:!!process.env.TWILIO_AUTH_TOKEN,sender:process.env.TWILIO_WHATSAPP_NUMBER?.replace('whatsapp:','')||null,numbers:rows.map(r=>String(r.phone).replace('whatsapp:',''))}}})
 app.post('/menu-workspace/whatsapp/code',{preHandler:requireRole('owner')},async(req,reply)=>{if(!process.env.TWILIO_AUTH_TOKEN)return reply.code(503).send({error:{message:'Canale Twilio non configurato'}});const code=randomBytes(12).toString('hex');await db.transaction(async tx=>{await tx.execute(sql`DELETE FROM tako_whatsapp_codes WHERE actor_id=${req.user.id} AND restaurant_id=${req.user.restaurantId}`);await tx.execute(sql`INSERT INTO tako_whatsapp_codes(code_hash,restaurant_id,actor_id,expires_at) VALUES(${digest(code)},${req.user.restaurantId},${req.user.id},now()+interval '15 minutes')`)});return{data:{code,sender:process.env.TWILIO_WHATSAPP_NUMBER?.replace('whatsapp:',''),message:'collega tako '+code,expiresInMinutes:15}}})
 app.post('/menu-workspace/whatsapp/disconnect',{preHandler:requireRole('owner')},async req=>{await db.transaction(async tx=>{await tx.execute(sql`DELETE FROM tako_whatsapp_proposals WHERE restaurant_id=${req.user.restaurantId} AND actor_id=${req.user.id}`);await tx.execute(sql`DELETE FROM tako_whatsapp_links WHERE restaurant_id=${req.user.restaurantId} AND actor_id=${req.user.id}`);await tx.execute(sql`DELETE FROM tako_whatsapp_codes WHERE restaurant_id=${req.user.restaurantId} AND actor_id=${req.user.id}`)});return{data:{disconnected:true}}})
 // WhatsApp del titolare (agenzia o titolare del locale, verificato qui): un locale = un telefono, un telefono = un locale.
 // Salvare crea un pre-collegamento (activated_at NULL), senza codici né messaggi in uscita; il primo messaggio di quel numero lo attiva.
 const ownerDenied=(reply:any)=>reply.code(403).send({error:{code:'FORBIDDEN',message:'Solo l\'agenzia o il titolare del locale possono gestire il WhatsApp del titolare.'}})
 const ownerState=async(tx:Tx,tenant:string)=>{const rows=await tx.execute(sql`SELECT phone,activated_at FROM tako_whatsapp_links WHERE restaurant_id=${tenant} ORDER BY created_at DESC LIMIT 1`),row=rows[0];return{configured:!!process.env.TWILIO_AUTH_TOKEN,sender:process.env.TWILIO_WHATSAPP_NUMBER?.replace('whatsapp:','')||null,phone:row?String(row.phone).replace('whatsapp:',''):null,status:row?(row.activated_at==null?'pending':'linked'):null}}
 app.get('/menu-workspace/whatsapp/owner',{preHandler:requireRole('owner')},async(req,reply)=>{if(!await permitted(db,req.user.id,req.user.restaurantId))return ownerDenied(reply);return{data:await ownerState(db,req.user.restaurantId)}})
 app.post('/menu-workspace/whatsapp/owner',{preHandler:requireRole('owner')},async(req,reply)=>{
  const input=(req.body??{}) as {phone?:unknown,move?:unknown},e164=normalizeOwnerPhone(input.phone),tenant=req.user.restaurantId,actor=req.user.id
  if(!e164)return reply.code(400).send({error:{code:'VALIDATION',message:'Numero non valido: scrivi un cellulare italiano, ad esempio 333 123 4567.'}})
  const phone=whatsappAddress(e164);if(phone===process.env.TWILIO_WHATSAPP_NUMBER)return reply.code(400).send({error:{code:'VALIDATION',message:'Questo è il numero di Tako: inserisci quello del titolare.'}})
  const result=await db.transaction(async tx=>{
   if(!await permitted(tx,actor,tenant))return{forbidden:true as const}
   await lock(tx,phone);await lock(tx,'tako-owner-link:'+tenant)
   const rows=await tx.execute(sql`SELECT l.restaurant_id,l.activated_at,r.name FROM tako_whatsapp_links l JOIN restaurants r ON r.id=l.restaurant_id WHERE l.phone=${phone}`),existing=rows[0]
   if(existing&&String(existing.restaurant_id)===tenant)return{state:await ownerState(tx,tenant)}
   if(existing){const other=String(existing.restaurant_id),canMove=await permitted(tx,actor,other);if(input.move!==true||!canMove)return{conflict:{name:canMove?String(existing.name):null,canMove}}}
   await tx.execute(sql`DELETE FROM tako_whatsapp_proposals WHERE phone=${phone} OR phone IN (SELECT phone FROM tako_whatsapp_links WHERE restaurant_id=${tenant})`)
   await tx.execute(sql`DELETE FROM tako_whatsapp_links WHERE phone=${phone} OR restaurant_id=${tenant}`)
   await tx.execute(sql`INSERT INTO tako_whatsapp_links(phone,restaurant_id,actor_id,activated_at) VALUES(${phone},${tenant},${actor},NULL)`)
   return{state:await ownerState(tx,tenant)}})
  if('forbidden' in result)return ownerDenied(reply)
  if('conflict' in result&&result.conflict){const c=result.conflict;return reply.code(409).send({error:{code:c.canMove?'PHONE_IN_USE_MOVABLE':'PHONE_IN_USE',message:c.canMove?`Questo numero è già collegato a ${c.name}. Vuoi spostarlo su questo locale?`:'Questo numero è già collegato a un altro locale. Per spostarlo contatta Tako.',canMove:c.canMove}})}
  return{data:result.state}})
 app.delete('/menu-workspace/whatsapp/owner',{preHandler:requireRole('owner')},async(req,reply)=>{const tenant=req.user.restaurantId
  const done=await db.transaction(async tx=>{if(!await permitted(tx,req.user.id,tenant))return false;await lock(tx,'tako-owner-link:'+tenant)
   await tx.execute(sql`DELETE FROM tako_whatsapp_proposals WHERE phone IN (SELECT phone FROM tako_whatsapp_links WHERE restaurant_id=${tenant})`)
   await tx.execute(sql`DELETE FROM tako_whatsapp_links WHERE restaurant_id=${tenant}`)
   await tx.execute(sql`DELETE FROM tako_whatsapp_codes WHERE restaurant_id=${tenant}`);return true})
  if(!done)return ownerDenied(reply);return{data:await ownerState(db,tenant)}})
 app.addContentTypeParser('application/x-www-form-urlencoded',{parseAs:'string'},(_req,body,done)=>{const values=new URLSearchParams(String(body)),form:Record<string,string>={};for(const[k,v]of values){if(k in form)return done(Error('Duplicate form key'));form[k]=v}done(null,form)})
 app.post('/whatsapp/twilio',{bodyLimit:32768},async(req,reply)=>{
 const form=req.body as Record<string,string>,signature=String(req.headers['x-twilio-signature']||''),endpoint=process.env.TWILIO_WEBHOOK_URL||'';
 if(req.url!=='/api/whatsapp/twilio'||!form||!validTwilioSignature(process.env.TWILIO_AUTH_TOKEN||'',endpoint,form,signature)||form.AccountSid!==process.env.TWILIO_ACCOUNT_SID||form.To!==process.env.TWILIO_WHATSAPP_NUMBER)return reply.code(403).send('Forbidden');
 // Owner invitation is a separate trust boundary: validate the signed envelope before consuming it,
 // and never forward activation tokens to another service. Helper owns its DB transaction.
 if(/^attiva takomenu\b/i.test(form.Body||'')){
  if(!/^whatsapp:\+\d{8,15}$/.test(form.From||'')||!/^(?:SM|MM)[a-f0-9]{32}$/i.test(form.MessageSid||''))return reply.code(400).send('Invalid message');
  const cached=await db.execute(sql`SELECT response FROM tako_whatsapp_messages WHERE sid=${form.MessageSid}`);if(cached.length)return reply.type('text/xml; charset=utf-8').send(twiml(String(cached[0]!.response)));
  const {activateOwnerInvite}=await import('../lib/onboarding-owner-invite.js');const messages=await activateOwnerInvite(form.From!,form.Body||'');const text=(messages??['L’invito *non è valido*. Chiedi un nuovo link alla tua agenzia.']).join(nextMessage);
  const response=await db.transaction(async tx=>{await lock(tx,form.From!);const duplicate=await tx.execute(sql`SELECT response FROM tako_whatsapp_messages WHERE sid=${form.MessageSid}`);if(duplicate.length)return String(duplicate[0]!.response);await tx.execute(sql`INSERT INTO tako_whatsapp_messages(sid,response) VALUES(${form.MessageSid},${text}) ON CONFLICT DO NOTHING`);return text});
  return reply.type('text/xml; charset=utf-8').header('Cache-Control','no-store').send(twiml(response));
 }
 const lifecycleCommand=/^(?:avvia|riprendi) onboarding\b/i.test(form.Body||'');
 if(lifecycleCommand&&process.env.TAKO_WHATSAPP_ONBOARDING_ENABLED!=='1')return reply.type('text/xml; charset=utf-8').header('Cache-Control','no-store').send(twiml('Il collegamento *non è disponibile*. Generane uno nuovo dalla dashboard agenzia.'));
 if(process.env.TAKO_WHATSAPP_ONBOARDING_ENABLED==='1'&&/^whatsapp:\+\d{8,15}$/.test(form.From||'')&&/^(?:SM|MM)[a-f0-9]{32}$/i.test(form.MessageSid||'')&&(form.Body||'').length<=2000){
  const {onboardingTransport,queueOnboardingChat,expiredOnboardingNotice,startsOnboarding}=await import('../lib/onboarding-chat.js');const pair=/^collega agenzia\b/i.test(form.Body||'');
  if(pair){const prior=await db.execute(sql`SELECT response FROM tako_whatsapp_messages WHERE sid=${form.MessageSid}`);if(prior.length)return reply.type('text/xml; charset=utf-8').send(twiml(String(prior[0]!.response)))}
  const agencyOnlyVoice=!!whatsappAudioType(form.MediaContentType0,form.Body)&&!(await db.execute(sql`SELECT 1 FROM tako_whatsapp_links WHERE phone=${form.From!}`)).length;
  const agency=await onboardingTransport(form.From!,form.Body||'',agencyOnlyVoice);
  // The answer always arrives by REST from the queue. The immediate TwiML ack is only for a brand-new draft;
  // acking every step made each reply look doubled («Sto preparando il nuovo locale» after a name or a vocal).
  if(agency){const fresh=!agency.active&&(startsOnboarding(form.Body||'')||/^avvia onboarding\b/i.test(form.Body||'')),queued=await queueOnboardingChat(agency.actor,form.From!,form.MessageSid!,form.Body||'',form);return reply.type('text/xml; charset=utf-8').header('Cache-Control','no-store').send(twiml(queued&&fresh?'Sto preparando il *nuovo locale*. Resta privato fino alla tua approvazione.':''))}
  // A draft that just expired must not turn its follow-ups (LOGO:, a menu vocal) into edits of a real restaurant.
  if(!lifecycleCommand&&!pair){const notice=await expiredOnboardingNotice(form.From!,form.Body||'',form);if(notice!==null&&typeof notice==='object'){await queueOnboardingChat(notice.voiceActor,form.From!,form.MessageSid!,form.Body||'',form);return reply.type('text/xml; charset=utf-8').header('Cache-Control','no-store').send(twiml(''))}if(notice!==null)return reply.type('text/xml; charset=utf-8').header('Cache-Control','no-store').send(twiml(notice))}
  if(lifecycleCommand)return reply.type('text/xml; charset=utf-8').header('Cache-Control','no-store').send(twiml('Il collegamento è *scaduto o non valido* per questo numero. Genera un nuovo QR dalla dashboard agenzia.'));
  if(pair)return reply.type('text/xml; charset=utf-8').header('Cache-Control','no-store').send(twiml('Il collegamento agenzia è *scaduto o non valido*. Generane uno nuovo dalla dashboard agenzia.'))
 }
 if(lifecycleCommand)return reply.code(400).send('Invalid onboarding message');
 const linked=await db.execute(sql`SELECT 1 FROM tako_whatsapp_links WHERE phone=${form.From||''}`);if(!shouldHandleInTako(linked.length>0,form.Body||''))try{const forwarded=await forwardTwilioWebhook(process.env.MENUSMART_WHATSAPP_WEBHOOK_URL||menusmartWebhook,process.env.TWILIO_AUTH_TOKEN||'',form);if(forwarded.contentType)reply.header('Content-Type',forwarded.contentType);return reply.code(forwarded.status).send(forwarded.body)}catch(error){req.log.error({error:error instanceof Error?error.name:'Error'},'MenuSmart WhatsApp forward failed');await inBackground(reportFailure({kind:'menusmart_forward',detail:error instanceof Error?error.name:'Error'}));return reply.type('text/xml; charset=utf-8').header('Cache-Control','no-store').send(twiml(''))}
 const phone=form.From||'',sid=form.MessageSid||'',body=(form.Body||'').trim(),media=Number(form.NumMedia||0);if(!/^whatsapp:\+\d{8,15}$/.test(phone)||!(/^SM[a-f0-9]{32}$/i.test(sid)||linked.length>0&&/^MM[a-f0-9]{32}$/i.test(sid))||body.length>2000)return reply.code(400).send('Invalid message');
 const scope:{tenant?:string}={};const result=await db.transaction(async tx=>{await lock(tx,phone);const cached=await tx.execute(sql`SELECT response FROM tako_whatsapp_messages WHERE sid=${sid}`);if(cached.length){const text=String(cached[0]!.response);return text.startsWith(sent)?'':text}
 const answer=async(text:string)=>{await tx.execute(sql`INSERT INTO tako_whatsapp_messages(sid,response) VALUES(${sid},${text}) ON CONFLICT DO NOTHING`);return text};
 const pair=body.match(/^collega tako ([a-f0-9]{24})$/i);if(pair){const codes=await tx.execute(sql`DELETE FROM tako_whatsapp_codes WHERE code_hash=${digest(pair[1]!.toLowerCase())} AND expires_at>now() RETURNING restaurant_id,actor_id`);const code=codes[0];if(!code||!await permitted(tx,String(code.actor_id),String(code.restaurant_id)))return answer(copy.codeInvalid);await tx.execute(sql`DELETE FROM tako_whatsapp_proposals WHERE phone=${phone} OR phone IN (SELECT phone FROM tako_whatsapp_links WHERE restaurant_id=${code.restaurant_id})`);await tx.execute(sql`DELETE FROM tako_whatsapp_links WHERE restaurant_id=${code.restaurant_id} AND phone<>${phone}`);await tx.execute(sql`INSERT INTO tako_whatsapp_links(phone,restaurant_id,actor_id,activated_at) VALUES(${phone},${code.restaurant_id},${code.actor_id},now()) ON CONFLICT(phone) DO UPDATE SET restaurant_id=EXCLUDED.restaurant_id,actor_id=EXCLUDED.actor_id,created_at=now(),activated_at=now()`);return answer(await welcomeFor(tx,String(code.restaurant_id)))}
 const ctx=await linkedContext(tx,phone);if(!ctx)return answer('');scope.tenant=ctx.tenant
 // Primo messaggio di un numero pre-collegato dalla dashboard: qualunque cosa scriva, si attiva e riceve benvenuto + «cosa sai fare».
 if(ctx.pending){await tx.execute(sql`UPDATE tako_whatsapp_links SET activated_at=now() WHERE phone=${phone} AND activated_at IS NULL`);await tx.execute(sql`DELETE FROM tako_whatsapp_proposals WHERE phone=${phone}`);return answer(await welcomeFor(tx,ctx.tenant)+nextMessage+copy.help)}
 if(phone===testFaultPhone&&ctx.tenant===qaTenant&&normalizeMenuText(body)==='guasto di prova')throw new TestFault('Guasto simulato')
 if(media>0){const type=form.MediaContentType0||'',job=whatsappAudioType(type,body)?'audio' as const:/^image\//i.test(type)?'image' as const:null;if(!job)return answer(copy.mediaOnly);await reserve(tx,sid);return{job,ctx,ack:''}}
 if(!body)return answer(copy.help);const turn=await menuTurn(tx,ctx,body);if(typeof turn==='string')return answer(turn);if('llm' in turn&&!process.env.GROQ_API_KEY)return answer(copy.noAi);await reserve(tx,sid);return{job:'text' as const,ctx,ack:'upload' in turn?copy.photoWorking:''}}).catch(async error=>{req.log.error({error:error instanceof Error?error.message.slice(0,80):'Error'},'WhatsApp turn failed');await inBackground(reportFailure({kind:error instanceof TestFault?'test_fault':'webhook_error',tenant:scope.tenant??null,phone,detail:error instanceof Error?error.message:'Error'}));return copy.failed});
 if(typeof result==='string')return reply.type('text/xml; charset=utf-8').header('Cache-Control','no-store').send(twiml(result))
 const job=runJob(result.job,result.ctx,sid,body,form).catch(error=>req.log.error({error:error instanceof Error?error.message.slice(0,80):'Error'},'WhatsApp AI job failed')),runtime=(globalThis as any).EdgeRuntime;if(typeof runtime?.waitUntil==='function')runtime.waitUntil(job);else await job
 return reply.type('text/xml; charset=utf-8').header('Cache-Control','no-store').send(twiml(result.ack))
 })
}
