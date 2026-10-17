import type {FastifyInstance} from 'fastify'
import {db,type DB} from '@tako/db'
import {sql} from 'drizzle-orm'
import {createHash,randomBytes,randomUUID} from 'node:crypto'
import {requireRole} from '../middleware/auth.js'
import {isAgencyUser} from '../lib/agency-access.js'
import {readWorkspace,mutateWorkspace,WorkspaceTrialLocked} from '../lib/menu-workspace-store.js'
import {workspaceSchema,type Workspace} from '../lib/menu-workspace-contract.js'
import {Buffer} from 'node:buffer'
import {priceChoice,effectiveMenuActions,mergeMenuActions,appliedMenuText,groqPendingMenuPlan,validatePendingMenuPlan,validateMenuPlan,groqMenuPlan,groqDishPick,validateDishPick,dishMatches,itemLabel,photoProblem,downscaleSourcePixels,applyActions,planText,welcomeText,safe,localDate,capabilityText,readText,GroqBusy,type GroqOptions,type UsageEvent,downloadTwilioMedia,transcribeAudio,whisperPrompt,sendWhatsApp,proposalText,type MenuRef,type SectionRef,type MenuAction,type MenuPlan} from '../lib/twilio-menu-ai.js'
import {copy,helpWords,fill} from '../lib/twilio-menu-copy.js'
import {createStep,createQuestion,followUp,undoFor,categoryWordItems,revertTarget,groupCommand,type CreateDraft,type LastApplied} from '../lib/twilio-menu-create.js'
import {words,exactPick,politeCommand,spokenDecimals,spokenCents,parseIntent,findDishes,preselect,candidatesFor,resolveChoice,capabilityFromText,isThanks,compoundIntents,looksLikeQuestion,wantsCreateText,wantsSpecialText,isCompoundMessage,type Intent} from '../lib/twilio-menu-nlu.js'
import {validTwilioSignature,shouldHandleInTako,replyIntent,forwardTwilioWebhook,parseMenuCommand,normalizeMenuText,twiml,nextMessage,whatsappAudioType,type MenuCommand} from '../lib/twilio-menu-command.js'
import {reportFailure,inBackground,quietPhones,type FailureKind} from '../lib/twilio-menu-alerts.js'
import {normalizeOwnerPhone,whatsappAddress} from '../lib/whatsapp-phone.js'
import {fullMenuTurn,type FullMenuJob} from '../lib/twilio-menu-fullmenu.js'
import {extractFullMenu,fullMenuFetcher,type FullMenuExtraction} from '../lib/menu-full-extract.js'
import {OnboardingBusy} from '../lib/onboarding-planner.js'
import {presetChatCommand} from '../lib/menu-preset-target.js'
import {fullMenuCopy} from '../lib/twilio-menu-copy.js'
import {parseSalesText,salesTurn,salesActionProblem,categoryItems,type SalesTemplate} from '../lib/twilio-menu-sales.js'
import {businessDate} from '../lib/menu-sales.js'
import {negatedClauses,isExcluded,bareDish,looksLikeAnswer,pickPrice,allOptions,leadingInterjection,confirmCleanup,type Excluded} from '../lib/twilio-menu-clarify.js'
import {brainGate,hasFreshHistory,brainPlan,memoryTurn,rememberTurn,learnAfter,botBrainEnabled,trackChange,readRestorable} from '../lib/owner-brain-route.js'
import {composeReply,REFERS} from '../lib/owner-brain-plan.js'
import {stripLeadBeforeRemoval,clearChanges,holdFromMessage,holdAnswer,holdQuestion,undoRecordFor,isUndoRequest,applyUndo,undoText,undoWindowMs,type Hold,type UndoRecord} from '../lib/twilio-menu-hold.js'
import {startsWithCreate,parseCreate,createCompound} from '../lib/twilio-menu-create.js'
import {removeVerbRe} from '../lib/twilio-menu-nlu.js'
import {phoneticCandidates} from '../lib/twilio-menu-phonetic.js'
import {parseStructure,DELETE_VERB,plainName,sameSection} from '../lib/twilio-menu-structure.js'
import {sqlBrainStore} from '../lib/owner-brain-memory.js'
const menusmartWebhook='https://mtdguvbpdmekgzaemqoy.supabase.co/functions/v1/whatsapp-webhook'
const digest=(s:string)=>createHash('sha256').update(s).digest('hex')
async function permitted(tx:Pick<DB,'execute'>,actor:string,tenant:string){const rows=await tx.execute(sql`SELECT u.id,u.restaurant_id,u.role,r.active FROM users u JOIN restaurants r ON r.id=${tenant} WHERE u.id=${actor} AND u.active=true`);const u=rows[0];if(!u||!u.active)return false;if(isAgencyUser(actor))return true;if(u.restaurant_id===tenant&&u.role==='owner')return true;const membership=await tx.execute(sql`SELECT role FROM web_location_memberships WHERE user_id=${actor} AND restaurant_id=${tenant}`);return membership[0]?.role==='owner'}
const sent='\u0001'
type Ctx={phone:string,tenant:string,actor:string,pending?:boolean};type Tx=Pick<DB,'execute'>;type Photo={mediaUrl:string,mediaType:string,url?:string};type ChoiceAction={kind:'price',price:number}|{kind:'available'|'hidden'|'featured',value:boolean}|{kind:'description',text:string}|{kind:'tag',tag:string,value:boolean}|SalesTemplate;type Choice={kind:'choose',action:ChoiceAction,options:string[]};type ChoicePrice={kind:'choose_price',id:string,prices:[number,number],labels:[string,string]};type Turn=string|{llm:true,brain?:true,photo?:Photo,text?:string,fullmenu?:FullMenuJob,exclude?:Excluded[],note?:string}|{upload:Extract<MenuAction,{kind:'image'}>[]}
const lock=(tx:Tx,phone:string)=>tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${phone},0))`)
const reserve=(tx:Tx,sid:string)=>tx.execute(sql`INSERT INTO tako_whatsapp_messages(sid,response) VALUES(${sid},${sent}) ON CONFLICT DO NOTHING`)
const propose=(tx:Tx,ctx:Ctx,revision:number,command:unknown)=>tx.execute(sql`INSERT INTO tako_whatsapp_proposals(phone,restaurant_id,actor_id,revision,command,expires_at) VALUES(${ctx.phone},${ctx.tenant},${ctx.actor},${revision},${JSON.stringify(command)}::jsonb,now()+interval '10 minutes') ON CONFLICT(phone) DO UPDATE SET restaurant_id=EXCLUDED.restaurant_id,actor_id=EXCLUDED.actor_id,revision=EXCLUDED.revision,command=EXCLUDED.command,expires_at=EXCLUDED.expires_at`)
// Memoria dell'ultima modifica applicata (G2/G3), fuori dalle proposte: chiave `last:<telefono>` in tako_whatsapp_messages
// (nessuna migrazione, invisibile a conferma/annulla). Vale 10 minuti e solo se il menu non è cambiato nel frattempo.
const lastKey=(phone:string)=>'last:'+phone
const lastAge=(last:LastApplied)=>Date.now()-Number((last as any).at??0)
async function readLast(tx:Tx,phone:string,revision:number):Promise<LastApplied|null>{let rows:any[];try{rows=await tx.execute(sql`SELECT response FROM tako_whatsapp_messages WHERE sid=${lastKey(phone)}`)??[]}catch{return null}try{const v=JSON.parse(String(rows[0]?.response??'null'));return v&&v.kind==='last'&&v.revision===revision&&Date.now()-Number(v.at)<3600000?v:null}catch{return null}}
async function writeLast(tx:Tx,phone:string,value:(LastApplied&{revision:number,at:number})|null){const text=JSON.stringify(value);await tx.execute(sql`UPDATE tako_whatsapp_messages SET response=${text} WHERE sid=${lastKey(phone)}`);await tx.execute(sql`INSERT INTO tako_whatsapp_messages(sid,response) VALUES(${lastKey(phone)},${text}) ON CONFLICT DO NOTHING`)}
// 17/10: «annulla» vero. L'ultima pubblicazione fatta da WhatsApp (voci prima/dopo) in `undo:<telefono>`, 10 minuti.
const undoKey=(phone:string)=>'undo:'+phone
async function readUndo(tx:Tx,phone:string):Promise<UndoRecord|null>{let rows:any[];try{rows=await tx.execute(sql`SELECT response FROM tako_whatsapp_messages WHERE sid=${undoKey(phone)}`)??[]}catch{return null}try{const v=JSON.parse(String(rows[0]?.response??'null'));return v&&v.kind==='undo'&&Array.isArray(v.items)?v:null}catch{return null}}
async function writeUndo(tx:Tx,phone:string,value:UndoRecord|null){const text=JSON.stringify(value);await tx.execute(sql`UPDATE tako_whatsapp_messages SET response=${text} WHERE sid=${undoKey(phone)}`);await tx.execute(sql`INSERT INTO tako_whatsapp_messages(sid,response) VALUES(${undoKey(phone)},${text}) ON CONFLICT DO NOTHING`)}
// 17/10 (AI Act art. 50): la riga «assistente automatico» una sola volta per numero (`ai:<telefono>`).
const aiKey=(phone:string)=>'ai:'+phone
async function discloseOnce(tx:Tx,phone:string):Promise<boolean>{const rows=await tx.execute(sql`SELECT response FROM tako_whatsapp_messages WHERE sid=${aiKey(phone)}`);if(rows?.length)return false;await tx.execute(sql`INSERT INTO tako_whatsapp_messages(sid,response) VALUES(${aiKey(phone)},${'1'}) ON CONFLICT DO NOTHING`);return true}
// activated_at NULL = pre-collegamento dalla dashboard: il numero è già di Takomenu (mai inoltrato a MenuSmart) e il primo messaggio lo attiva.
async function linkedContext(tx:Tx,phone:string):Promise<Ctx|null>{const links=await tx.execute(sql`SELECT restaurant_id,actor_id,activated_at FROM tako_whatsapp_links WHERE phone=${phone}`),link=links[0];return link&&await permitted(tx,String(link.actor_id),String(link.restaurant_id))?{phone,tenant:String(link.restaurant_id),actor:String(link.actor_id),pending:link.activated_at==null}:null}
async function welcomeFor(tx:Tx,tenant:string){const restaurant=await tx.execute(sql`SELECT name FROM restaurants WHERE id=${tenant}`),current=await readWorkspace(tenant,tx),catalog=current?catalogOf(workspaceSchema.parse(current.draft)):{refs:[],sections:[]};return welcomeText(String(restaurant[0]?.name),catalog.refs,catalog.sections)}
// Guasto simulato per la verifica dal vivo: SOLO questo numero finto (+39 000…, non assegnabile) collegato al locale QA, con questa frase esatta.
const testFaultPhone='whatsapp:+390000000099',qaTenant='26050ecd-2e55-4057-a4c5-bff2b449cd47';class TestFault extends Error{}
const catalogOf=(w:Workspace)=>({refs:w.menus.flatMap(m=>m.sections.flatMap(s=>s.items.map(i=>({id:i.id,name:i.name,price:i.price,available:i.available,hidden:i.hidden,menu:m.name,section:s.name,sectionId:s.id,hasImage:!!i.imageUrl,featured:i.featured,tags:i.tags} as MenuRef)))),sections:w.menus.flatMap(m=>m.sections.map(s=>({id:s.id,name:s.name,menu:m.name} as SectionRef)))})
const shown=(target:string)=>target.replace(/^(il|lo|la|i|gli|le|l|un|una|uno)\s+/i,'').slice(0,60)
const bold=(names:string[])=>names.map(n=>'*'+safe(n)+'*').join(', ')
function storedActions(command:any,refs:MenuRef[],sections:SectionRef[]):MenuAction[]|null{
 if(command?.kind==='fullmenu')return null
 if(command?.kind==='batch'&&Array.isArray(command.actions)){const fresh=new Set(command.actions.filter((a:any)=>a.kind==='create_section').map((a:any)=>a.newSectionId)),okSec=(id:string)=>sections.some(s=>s.id===id)||fresh.has(id)
  return command.actions.every((a:any)=>a.kind==='special'||a.kind==='create_section'||(a.kind==='rename_section'?sections.some(s=>s.id===a.sectionId):a.kind==='create'?okSec(a.sectionId):a.kind==='move'?okSec(a.sectionId)&&refs.some(r=>r.id===a.id):refs.some(r=>r.id===a.id)))?command.actions:null}
 const legacy=command as MenuCommand|null;if(!legacy||typeof (legacy as any).name!=='string')return null;const matches=legacy?refs.filter(r=>normalizeMenuText(r.name)===normalizeMenuText(legacy.name)):[];if(!legacy||matches.length!==1)return null;return[legacy.kind==='price'?{kind:'price',id:matches[0]!.id,price:legacy.price}:{kind:legacy.kind,id:matches[0]!.id,value:legacy.value}]
}
type TurnOpts={brainOff?:boolean,planned?:{revision:number,plan:MenuPlan,proposalRevision?:string},plannedFull?:{revision:number,job:FullMenuJob,extraction:FullMenuExtraction},voice?:boolean,isExpired?:()=>boolean,uploads?:Map<string,string>,exclude?:Excluded[]}
type TurnState={text?:string,exclude:Excluded[],note?:string,brain?:boolean,postDraft?:CreateDraft}
const choiceTemplate=(a:MenuAction):ChoiceAction|null=>{if(!('id' in a))return null;const {id:_id,...rest}=a as any;return ['price','available','hidden','featured','description','tag','promo','scarcity'].includes(a.kind)?rest as ChoiceAction:null}
/** Turno del bot. Se il testo è stato ripulito (clausole negate) o ci sono piatti esclusi, il passaggio all'IA li porta con sé. */
export async function menuTurn(tx:Tx,ctx:Ctx,text:string,opts:TurnOpts={}):Promise<Turn>{
 const st:TurnState={exclude:opts.exclude??[]},r0=await menuTurnCore(tx,ctx,text,opts,st)
 // Cervello acceso: ogni turno che andrebbe all'IA va al cervello (la vecchia chiamata resta la riserva).
 const r:Turn=typeof r0==='object'&&'llm' in r0&&!r0.photo&&!r0.fullmenu&&st.brain&&!opts.brainOff?{...r0,brain:true}:r0
 if(typeof r==='object'&&'llm' in r&&!r.photo&&!r.fullmenu&&(st.text!==undefined||st.exclude.length||st.note))return{...r,...(st.text!==undefined&&r.text===undefined?{text:st.text}:{}),...(st.exclude.length?{exclude:st.exclude}:{}),...(st.note?{note:st.note}:{})}
 if(typeof r==='string'&&r&&st.note&&!r.includes(st.note))return r+'\n\n'+st.note
 return r
}
async function menuTurnCore(tx:Tx,ctx:Ctx,text:string,opts:TurnOpts,st:TurnState):Promise<Turn>{
 if(opts.isExpired?.())throw new Error('WhatsApp turn expired');
 // Fase B (17/10): «sì», «sì eliminalo», «cancella pure» confermano una richiesta di eliminazione in attesa.
 if(!opts.planned&&!opts.plannedFull&&/^\s*(?:(?:si|sì|ok|okay|conferm\w*|certo|esatto|vai|procedi|va bene)[\s,!.]*)*(?:(?:elimina\w*|cancella\w*|crea\w*|toglilo|toglila|pure|procedi|vai|sì|si)[\s,!.]*)*$/i.test(text)&&/\S/.test(text)){const pr=(await tx.execute(sql`SELECT command FROM tako_whatsapp_proposals WHERE phone=${ctx.phone} AND expires_at>now()`))?.[0]?.command as any;if(pr?.kind==='batch'&&Array.isArray(pr.actions)&&pr.actions.some((a:any)=>a.kind==='delete'||a.kind==='create_section'))text='conferma'}
 if(!opts.planned&&!opts.plannedFull){text=spokenDecimals(text);const polite=politeCommand(text);if(polite)text=polite;text=stripLeadBeforeRemoval(text)}
 // 17/10 (vocale di Manuel): risposta alla domanda di una richiesta multipla in sospeso (`hold`): completa TUTTA la richiesta.
 let holdPick:MenuAction[]|null=null,tail=''
 if(!opts.planned&&!opts.plannedFull){const hr=(await tx.execute(sql`SELECT command,revision FROM tako_whatsapp_proposals WHERE phone=${ctx.phone} AND actor_id=${ctx.actor} AND restaurant_id=${ctx.tenant} AND expires_at>now()`))?.[0],hold=(hr?.command as any)?.kind==='hold'?hr!.command as Hold:null
  if(hold){const row0=await readWorkspace(ctx.tenant,tx);if(!row0||!row0.published||row0.revision!==row0.published_revision||Number(hr!.revision)!==row0.revision){await tx.execute(sql`DELETE FROM tako_whatsapp_proposals WHERE phone=${ctx.phone}`);return copy.menuChanged}
   const cat0=catalogOf(workspaceSchema.parse(row0.draft)),ans=holdAnswer(text,hold,cat0.refs)
   if(ans==='cancel'){await tx.execute(sql`DELETE FROM tako_whatsapp_proposals WHERE phone=${ctx.phone}`);return copy.cancelled}
   if(ans&&ans.remaining?.length){const next:Hold={kind:'hold',actions:ans.actions,asks:ans.remaining,...(hold.notes?.length?{notes:hold.notes}:{})};await tx.execute(sql`DELETE FROM tako_whatsapp_proposals WHERE phone=${ctx.phone}`);await propose(tx,ctx,row0.revision,next);return (ans.note?ans.note+'\n\n':'')+holdQuestion(next,cat0.refs,cat0.sections)}
   if(ans){if(!ans.actions.length){await tx.execute(sql`DELETE FROM tako_whatsapp_proposals WHERE phone=${ctx.phone}`);return (ans.note?ans.note+' ':'')+'Non ho cambiato nulla.'}holdPick=ans.actions;tail=[...(hold.notes??[]),ans.note??''].filter(Boolean).join('\n')
    if(ans.rest){const more=clearChanges(spokenDecimals(ans.rest),cat0.refs);if(more)holdPick=[...holdPick,...more];else tail=[tail,fill(copy.holdRestUnclear,{testo:safe(ans.rest).slice(0,80)})].filter(Boolean).join('\n\n')}}
   else{const i=parseIntent(text),question=looksLikeQuestion(text)||i?.kind==='ask'||i?.kind==='read'||i?.kind==='capability',fresh=!question&&(!!parseMenuCommand(text)||!!i||startsWithCreate(text)||isCompoundMessage(text,cat0.refs)||!!parseSalesText(text)||/\d/.test(text)&&words(text).length>0)
    if(fresh){await tx.execute(sql`DELETE FROM tako_whatsapp_proposals WHERE phone=${ctx.phone}`);tail=copy.holdDropped;st.note=copy.holdDropped}else if(!question)return holdQuestion(hold,cat0.refs,cat0.sections)}}}
 // 17/10: «ok grazie», «annulla, no anzi conferma» confermano un riepilogo in attesa (solo se c'è una proposta aperta).
 if(!opts.planned&&!opts.plannedFull&&!holdPick){const cleaned=confirmCleanup(text);if(cleaned!==text&&replyIntent(cleaned)&&!replyIntent(text)&&(await tx.execute(sql`SELECT 1 FROM tako_whatsapp_proposals WHERE phone=${ctx.phone} AND expires_at>now()`)).length)text=cleaned}
 const {phone,tenant,actor}=ctx,{planned,uploads}=opts,normalized=normalizeMenuText(text).replace(/[^a-z0-9]+/g,' ').trim(),intent=replyIntent(text),open=intent&&!['annulla','no','conferma','si','ok'].includes(normalized)?(await tx.execute(sql`SELECT 1 FROM tako_whatsapp_proposals WHERE phone=${phone} AND expires_at>now()`)).length>0:true,reply=open?intent:null;
 // Impostazioni del locale lette una volta per turno (prima fino a 3 letture uguali nello stesso turno).
 let settingsRows:Promise<any[]>|undefined;const restaurantSettings=()=>settingsRows??=Promise.resolve(tx.execute(sql`SELECT settings FROM restaurants WHERE id=${tenant}`)) as Promise<any[]>
 const revertLast=/^(no |scusa |aspetta |anzi )*(aspetta )?(lascia stare|lascia perdere|annulla l ultima( modifica)?|torna come prima|rimetti come prima)$/.test(normalized)
 // 17/10: «annulla / torna indietro / rimetti com'era» senza riepilogo in attesa = annulla l'ultima pubblicazione da WhatsApp (10 minuti).
 let undoRec:UndoRecord|null=null
 if(!holdPick&&!planned&&!opts.plannedFull&&isUndoRequest(text)){const waiting=await tx.execute(sql`SELECT 1 FROM tako_whatsapp_proposals WHERE phone=${phone} AND expires_at>now()`)
  if(!waiting.length){undoRec=await readUndo(tx,phone);if(undoRec&&Date.now()-Number(undoRec.at)>undoWindowMs){await writeUndo(tx,phone,null);return copy.undoExpired}}}
 if(reply==='cancel'&&!holdPick&&!undoRec){const waiting=await tx.execute(sql`SELECT 1 FROM tako_whatsapp_proposals WHERE phone=${phone} AND expires_at>now()`);if(!waiting.length&&!revertLast)return copy.nothingToCancel;if(waiting.length){await tx.execute(sql`DELETE FROM tako_whatsapp_proposals WHERE phone=${phone}`);return copy.cancelled}}if(!holdPick&&helpWords.includes(normalized))return copy.help;
 const row=await readWorkspace(tenant,tx);if(!row||!row.published)return copy.notPublished;if(row.revision!==row.published_revision)return copy.dashboardPending;const workspace=workspaceSchema.parse(row.draft),{refs,sections}=catalogOf(workspace);
 if(undoRec){const res=applyUndo(workspace,undoRec);if(!res.ok)return fill(copy.undoConflict,{piatti:res.changed.slice(0,4).map(n=>'*'+safe(n)+'*').join(', ')})
  const next=workspaceSchema.parse(workspace);if(opts.isExpired?.())throw new Error('WhatsApp turn expired');const saved=await mutateWorkspace(tenant,actor,row.revision,next,false,'WhatsApp: annullamento',tx as unknown as DB);if(opts.isExpired?.())throw new Error('WhatsApp turn expired');await mutateWorkspace(tenant,actor,saved.revision,next,true,'WhatsApp: annullamento pubblicato',tx as unknown as DB);if(opts.isExpired?.())throw new Error('WhatsApp turn expired');await writeUndo(tx,phone,null);await writeLast(tx,phone,null);return undoText(res)}
 // Menu intero (Feature 1) e comandi dei preset (Feature 2): prima delle modifiche singole, null = flusso di prima.
 if(!planned&&!holdPick){const presetReply=opts.plannedFull?null:await presetChatCommand(tx,ctx,text);if(presetReply)return presetReply
  const settings=(await restaurantSettings())[0]?.settings as any
  const full=await fullMenuTurn(tx,ctx,text,{revision:row.revision,workspace,refs,reply,normalized,voice:opts.voice,timezone:String(settings?.timezone??'Europe/Rome'),plannedFull:opts.plannedFull,isExpired:opts.isExpired});if(full!==null)return full
  if(!opts.plannedFull){const cents=spokenCents(text);if(cents!==text){text=cents;st.text=text}}}
 const proposals=await tx.execute(sql`SELECT command,revision FROM tako_whatsapp_proposals WHERE phone=${phone} AND actor_id=${actor} AND restaurant_id=${tenant} AND expires_at>now() FOR UPDATE`),proposal=proposals[0],pending=(proposal?.command as any)?.kind==='photo'?proposal!.command as Photo&{kind:'photo'}:null,choice=(proposal?.command as any)?.kind==='choose'?proposal!.command as Choice:null,draft=(proposal?.command as any)?.kind==='create_draft'?proposal!.command as CreateDraft:null;
 const choicePrice=(proposal?.command as any)?.kind==='choose_price'&&Number(proposal!.revision)===row.revision?proposal!.command as ChoicePrice:null,choicePriceDish=choicePrice?refs.find(r=>r.id===choicePrice.id)??null:null
 // QA 17/10, caso 2: «non cambiare boh; metti …», «lascia stare X», «X no», «tranne X»: X escluso, il resto si elabora da solo.
 let negPick:MenuAction[]|null=null
 if(!planned&&!opts.plannedFull&&!holdPick){const lead=leadingInterjection(text,refs);if(lead){text=lead;st.text=text}
  const neg=negatedClauses(text.replace(/^\s*no\s*[,;.!]\s*(?=.+\bno\s*[.!]?\s*$)/i,''),refs,{keepLeadingLascia:!pending&&!choice&&!proposal});if(neg){st.exclude=[...st.exclude,...neg.excluded]
  if(neg.strip){const rest=normalizeMenuText(neg.rest).replace(/[^a-z0-9]+/g,' ').trim()
   // Risposta a «Quale piatto intendi?» per esclusione: «la carbonara no (, l'altro)» con due opzioni → l'altra.
   const left=choice?choice.options.filter(id=>!neg.excluded.some(e=>e.id===id)):[]
   if(choice&&left.length===1&&left.length<choice.options.length&&(!rest||/^(?:l altr[oa]|quell altr[oa]|l altro piatto|l altra|altro|altra|quello|quella)$/.test(rest)))negPick=[{...choice.action,id:left[0]!} as MenuAction]
   else if(!rest||/^(?:ok|okay|va bene|grazie|grazie mille|basta|niente|nient altro|solo questo)$/.test(rest)){
    // 17/10 (correzioni A): «la lasagna no» con un riepilogo in attesa la toglie DAVVERO dal riepilogo (prima diceva «resta com'è»
    // e l'«ok» dopo la pubblicava lo stesso).
    const pb=(proposal?.command as any)?.kind==='batch'&&Number(proposal!.revision)===row.revision&&Array.isArray((proposal!.command as any).actions)?proposal!.command as any:null,said=fill(copy.negatedOnly,{piatti:neg.names.map(safe).join(', ')})
    if(pb){const left=(pb.actions as MenuAction[]).filter(a=>!isExcluded(a as any,neg.excluded));if(left.length!==pb.actions.length){if(!left.length){await tx.execute(sql`DELETE FROM tako_whatsapp_proposals WHERE phone=${phone}`);return said}
     await tx.execute(sql`UPDATE tako_whatsapp_proposals SET command=${JSON.stringify({...pb,actions:left})}::jsonb WHERE phone=${phone}`);const restaurant=await tx.execute(sql`SELECT name FROM restaurants WHERE id=${tenant}`);return said+'\n\n'+proposalText(String(restaurant[0]?.name),left,refs,sections)}}
    return said}
   else{text=neg.rest;st.text=text}}}}
 // QA 17/10, caso 1: due prezzi alternativi → domanda, mai una scrittura. Con un piatto solo la risposta «14» la completa (10 minuti).
 if(!planned&&!holdPick){const pc=priceChoice(text,refs);if(pc){if(pc.store&&!proposal)await propose(tx,ctx,row.revision,{kind:'choose_price',...pc.store});return pc.text}}
 if(!holdPick&&reply==='confirm'&&draft&&Number(proposal!.revision)===row.revision&&!(draft.sectionName&&!draft.sectionId))return createQuestion(draft,sections);
 if(!holdPick&&reply==='confirm'&&!(draft&&draft.sectionName&&!draft.sectionId)){if(!proposal)return copy.nothingToConfirm;if(pending)return copy.photoNameFirst;if(choice)return copy.chooseFirst;if(choicePrice&&choicePriceDish)return fill(copy.choosePriceAgain,{piatto:itemLabel(choicePriceDish,refs),primo:choicePrice.labels[0],secondo:choicePrice.labels[1]});// Decisione di Manuel (16/10): il riepilogo oltre 3 modifiche si conferma con «OK», «conferma», «confermo», «va bene», «sì conferma»,
  // anche a voce. Vale solo un messaggio fatto SOLO di parole di conferma (replyIntent): «va bene così», «ok la carbonara 14» non confermano.
  if((proposal.command as any)?.requiresTypedOk&&!/^(?:(?:ok|okay|si|conferma|confermo|va|bene|procedi|pubblica)\s*)+$/.test(normalized))return copy.typedOk;const actions=Number(proposal.revision)===row.revision?storedActions(proposal.command,refs,sections):null;if(!actions){await tx.execute(sql`DELETE FROM tako_whatsapp_proposals WHERE phone=${phone}`);return copy.menuChanged}
  const photos=actions.filter((a):a is Extract<MenuAction,{kind:'image'}>=>a.kind==='image'),ready=new Map<string,string>([...photos.flatMap(a=>a.url&&storedUpload(tenant,a.url)?[[a.id,a.url] as [string,string]]:[]),...(uploads??[])]);if(photos.some(a=>!ready.has(a.id)))return{upload:photos.filter(a=>!ready.has(a.id))}
  const beforeW=structuredClone(workspace),restaurant=await restaurantSettings(),names=applyActions(workspace,actions,{uploads:ready,timezone:String((restaurant[0]?.settings as any)?.timezone??'Europe/Rome')}),next=workspaceSchema.parse(workspace)
  if(opts.isExpired?.())throw new Error('WhatsApp turn expired');const saved=await mutateWorkspace(tenant,actor,row.revision,next,false,'WhatsApp: bozza confermata',tx as unknown as DB);if(opts.isExpired?.())throw new Error('WhatsApp turn expired');await mutateWorkspace(tenant,actor,saved.revision,next,true,'WhatsApp: pubblicazione confermata',tx as unknown as DB);if(opts.isExpired?.())throw new Error('WhatsApp turn expired');await tx.execute(sql`DELETE FROM tako_whatsapp_proposals WHERE phone=${phone}`);await writeUndo(tx,phone,undoRecordFor(beforeW,next));if(st.brain)await trackChange(tx,phone,undoRecordFor(beforeW,next));void names;return appliedMenuText(actions,refs,sections)}
 // Cervello (17/10, perimetro N; settings.botBrain, spento di default): il modello capisce per primo con il contesto (cronologia,
 // memoria, scelta in sospeso). Restano deterministici: riepiloghi, foto, bozze, annulla, parte incerta («tojibo»), scelte già chiare.
 // Fase B (17/10): eliminare, rinominare, spostare, creare/rinominare categorie detti in modo esplicito: deterministici.
 let structPick:MenuAction[]|null=null
 // «no, il caviale lascialo stare» subito dopo averlo aggiunto da qui (10 minuti): si toglie il piatto appena creato, senza conferma.
 if(!planned&&!opts.plannedFull&&!holdPick&&!negPick&&!proposal&&/\b(?:lascia\w*\s+(?:stare|perdere)|lascial\w*\s+(?:stare|perdere)|non\s+(?:lo|la|li|le)\s+(?:aggiungere|mettere|volevo)|toglil[oaie]|leval[oaie])\b/.test(normalized)){const rec=await readUndo(tx,phone)
  if(rec&&Date.now()-Number(rec.at)<=undoWindowMs){const fresh=new Set(rec.items.filter(i=>i.before===null).map(i=>i.id)),hit=refs.filter(r=>fresh.has(r.id)&&(' '+normalized+' ').includes(' '+normalizeMenuText(r.name).replace(/[^a-z0-9]+/g,' ').trim()+' '));if(hit.length)structPick=hit.map(r=>({kind:'delete',id:r.id,undoCreate:true}) as MenuAction)}}
 if(!planned&&!opts.plannedFull&&!holdPick&&!negPick&&!proposal){const sp=parseStructure(text,refs,sections)
  if(sp?.kind==='ask')return sp.text
  if(sp?.kind==='delete'){const acts=sp.ids.map(id=>({kind:'delete',id}) as MenuAction);await propose(tx,ctx,row.revision,{kind:'batch',actions:acts,requiresTypedOk:true});return proposalText('',acts,refs,sections)}
  if(sp?.kind==='rename')structPick=[{kind:'rename',id:sp.id,name:sp.name}]
  if(sp?.kind==='rename_section')structPick=[{kind:'rename_section',sectionId:sp.sectionId,name:sp.name}]
  if(sp?.kind==='move'){if(sp.sectionId)structPick=sp.ids.map(id=>({kind:'move',id,sectionId:sp.sectionId!}) as MenuAction)
   else{const sid=randomUUID(),acts=[{kind:'create_section',newSectionId:sid,name:sp.sectionName,menuId:''} as MenuAction,...sp.ids.map(id=>({kind:'move',id,sectionId:sid}) as MenuAction)];await propose(tx,ctx,row.revision,{kind:'batch',actions:acts,requiresTypedOk:true})
    return fill(copy.sectionAsk,{categoria:safe(sp.sectionName),piatti:bold(sp.ids.map(id=>refs.find(r=>r.id===id)!.name)),categorie:sections.slice(0,15).map(x=>x.name).join(', ')})}}
  if(sp?.kind==='create_section'){const ex=sections.find(x=>sameSection(x.name,sp.name)),sid=ex?.id??randomUUID(),acts:MenuAction[]=ex?[]:[{kind:'create_section',newSectionId:sid,name:sp.name,menuId:''}]
   if(sp.rest){const c=parseCreate('aggiungi '+sp.rest.replace(/^(?:anche|dentro|ci)\s+/,''),[{id:sid,name:sp.name,menu:''}],true)
    if(c?.name&&c.price!==null&&!refs.some(r=>r.sectionId===sid&&plainName(r.name)===plainName(c.name!)))acts.push({kind:'create',sectionId:sid,name:c.name,price:c.price,description:null})
    else if(c?.name&&c.price===null){st.postDraft={kind:'create_draft',name:c.name,price:null,sectionId:sid}}}
   if(!acts.length&&!st.postDraft)return fill(copy.sectionExists,{categoria:safe(ex!.name)})
   if(!acts.length&&st.postDraft){await propose(tx,ctx,row.revision,st.postDraft);const q=createQuestion(st.postDraft,sections);st.postDraft=undefined;return fill(copy.sectionExists,{categoria:safe(ex!.name)})+' '+q}
   structPick=acts}}
 // 17/10 (A1.1): con una bozza di aggiunta in sospeso, un messaggio che non la completa («no, intendevo…») va al cervello con
 // la bozza nel contesto; le risposte pulite (prezzo, categoria, «sono due piatti», «10 e 20») restano deterministiche.
 const draftStuck=draft&&Number(proposal!.revision)===row.revision?(()=>{const s0=createStep(text,draft,sections,refs,parseIntent);return s0.kind==='none'||s0.kind==='ask'&&JSON.stringify(s0.draft)===JSON.stringify(draft)&&s0.text===createQuestion(draft,sections)})():false
 if(!planned&&!opts.plannedFull&&!opts.brainOff&&!holdPick&&!negPick&&!structPick&&!pending&&(!draft||draftStuck)&&(proposal?.command as any)?.kind!=='batch'&&(st.brain=botBrainEnabled((await restaurantSettings())[0]?.settings))){
  const mem=await memoryTurn(tx,tenant,text,refs);if(mem!==null)return mem
  const kind=(proposal?.command as any)?.kind??null,options=choice?choice.options.map(id=>refs.find(r=>r.id===id)).filter((r):r is MenuRef=>!!r):null
  if(brainGate({text,proposalKind:kind,choiceOptions:options,undoish:revertLast||revertTarget(text)==='',freshHistory:await hasFreshHistory(tx,tenant,phone)})){
   const h=kind?null:holdFromMessage(text,sections,refs);if(h&&'hold' in h){await propose(tx,ctx,row.revision,h.hold);return h.text}
   if(!h)return{llm:true,brain:true}}}
 const batch=proposal&&(proposal.command as any)?.kind==='batch'?storedActions(proposal.command,refs,sections):null;
 if(batch&&Number(proposal!.revision)!==row.revision){await tx.execute(sql`DELETE FROM tako_whatsapp_proposals WHERE phone=${phone}`);return copy.menuChanged}
 // Fase B: una domanda mentre una richiesta aspetta il «sì» (es. «boh c'è ancora?» dopo «elimina boh») si risponde e la richiesta resta.
 if(batch&&!planned&&looksLikeQuestion(text)){const ids=bareDish(text,refs).map(r=>r.id).concat(findDishes(text,refs).map(r=>r.id));const uniq=[...new Set(ids)].slice(0,6);if(uniq.length)return readText({type:'read',read:'items',ids:uniq},refs)+'\n\n'+copy.pendingStill}
 if(batch&&!planned)return{llm:true};
 // «prezzo Pasta e fagioli a 9»: la «e» del nome del piatto non rende composta la frase (era mandata all'IA, senza risposta in 45 s).
 // Aggiunta di un piatto: verbo iniziale o risposta alla domanda in attesa (bozza create_draft), sempre senza IA.
 let created:MenuAction[]|null=holdPick??negPick??structPick
 // G2/G3: «anche la lasagna», «no scusa 14», «scusa no era la lasagna» riferiti all'ultima modifica applicata.
 let preUndo:MenuAction[]=[],reverted=false
 // Risposta a «quale prezzo: 13 o 14?» (caso 1/3): uno dei due valori completa la richiesta; un altro numero → si ripete la domanda.
 if(!planned&&choicePrice&&choicePriceDish&&!created){if(allOptions(text,2))return fill(copy.choosePriceAgain,{piatto:itemLabel(choicePriceDish,refs),primo:choicePrice.labels[0],secondo:choicePrice.labels[1]});const v=pickPrice(text,choicePrice.prices);if(typeof v==='number')created=[{kind:'price',id:choicePriceDish.id,price:v}];else if(v==='other')return fill(copy.choosePriceAgain,{piatto:itemLabel(choicePriceDish,refs),primo:choicePrice.labels[0],secondo:choicePrice.labels[1]})}
 if(!planned&&!pending&&!choice&&!proposal){const last=await readLast(tx,phone,row.revision)
  // Round 3 (D): «lascia stare X, <comando>»: X è annullato solo se è il piatto dell'ultima modifica; il comando si applica.
  // «lascia stare, la lasagna è finita»: niente da annullare, vale il comando.
  const lsBare=text.match(/^(?:(?:no|scusa|aspetta|anzi)[\s,]+)*(?:lascia stare|lascia perdere)\s*[,;]\s*(.+)$/i)
  // «lascia stare, ho sbagliato» (17/10): è l'annullamento dell'ultima modifica, non un comando nuovo.
  if(lsBare&&/^(?:ho sbagliato|sbagliato|errore|era sbagliat\w*|mi sono sbagliat\w*|scusa)\b/i.test(lsBare[1]!.trim()))text='lascia stare'
  else if(lsBare&&!/^(?:va bene|ok|grazie|niente|basta)\b/i.test(lsBare[1]!.trim()))text=lsBare[1]!.trim()
  const ls=lsBare?null:text.match(/^(?:(?:no|scusa|aspetta|anzi)[\s,]+)*(?:lascia stare|lascia perdere)\s+([^,;]+?)\s*(?:(?:(?<!\d),(?!\d)|;)\s*(.+))?$/i)
  if(ls&&!/^(?:il resto|tutto il resto)$/i.test(ls[1]!.trim())||ls&&ls[2]){const x=ls[1]!.trim(),rest=ls[2]?.trim()??'',lastIds=new Set(last?last.actions.flatMap(a=>'id' in a?[a.id]:[]):[])
   const hit=last&&!/^(?:il resto|tutto il resto)$/i.test(x)?findDishes(x,refs).some(r=>lastIds.has(r.id)):false
   if(hit)preUndo=last!.undo
   if(rest&&preUndo.length&&!findDishes(rest,refs).length&&!/\b(?:costa|prezzo|promo|nascond|evidenza|aggiung)\w*\b/i.test(rest)){created=preUndo;preUndo=[];reverted=true}
   else if(rest&&!/^(?:va bene|ok|grazie|niente|basta)\b/i.test(rest))text=rest
   else if(preUndo.length){created=preUndo;preUndo=[];reverted=true}
   else return 'Va bene, non cambio nulla.'}
  else if(ls)return 'Va bene, non cambio nulla.'
  if(!created){const revert=revertTarget(text)
   if(revert!==undefined&&(!last||!last.undo.length))return revert?`Non ho una modifica recente su *${revert}* da annullare. Dimmi cosa vuoi, per esempio «${revert} è di nuovo disponibile».`:'Non c\'è un\'ultima modifica da annullare (o è passato troppo tempo). Dimmi cosa vuoi cambiare. Per annullare un menu intero scrivi «ripristina il menu di prima».'
   if(last){const next=followUp(text,last,refs,lastAge(last),businessDate(String(((await restaurantSettings())[0]?.settings as any)?.timezone??'Europe/Rome')));if(next&&'reply' in next)return next.reply;if(next){created=next;reverted=revert!==undefined}}}}
 // 17/10 (vocale di Manuel): richiesta multipla con una parte incerta («… e tojibo» = «togli boh»?) → le parti chiare in sospeso + una domanda.
 if(!created&&!planned&&!pending&&!choice&&!proposal){const h=holdFromMessage(text,sections,refs);if(h){if('hold' in h){await propose(tx,ctx,row.revision,h.hold);return h.text}created=h.actions;if(h.note)tail=[tail,h.note].filter(Boolean).join('\n\n')}}
 if(!created&&!planned&&!pending&&!choice){const step=createStep(text,draft&&Number(proposal!.revision)===row.revision?draft:null,sections,refs,parseIntent)
  if(step.kind==='ask'){await propose(tx,ctx,row.revision,step.draft);return step.text}
  if(step.kind==='exists'){if(draft)await tx.execute(sql`DELETE FROM tako_whatsapp_proposals WHERE phone=${phone}`);return fill(copy.alreadyExists,{piatto:step.name,categoria:step.section})}
  if(step.kind==='none'){const g=groupCommand(text,refs);if(g?.length)created=g}
  if(step.kind==='create')created=[step.action];if(step.kind==='createMany')created=step.actions;if(step.kind==='actions')created=step.actions;if(step.kind==='unhide')created=[{kind:'hidden',id:step.id,value:false}]}
 // Bassi (16/10): limiti detti in una riga, senza IA; «che pizze ci sono» con la lista della categoria.
 if(!planned&&!pending&&!choice&&!created){const low=normalizeMenuText(text).replace(/[^a-z0-9]+/g,' ').trim()
  // 17/10 (bassi delle batterie): «metti una foto alla carbonara», «metti la bruschetta nei primi», «aumenta tutti i primi di un euro».
  if(/\b(?:metti|mettere|aggiungi|aggiungere|carica|caricare|cambia|cambiare|inserisci|manda|mandare)\s+(?:una |la |le |delle |un |l )?(?:foto|immagin\w*)\b/.test(low))return capabilityText(['photo'])
  {const mv=low.match(/^(?:metti|porta)\s+(.+?)\s+(?:nei|negli|nelle|nel|nella|tra|fra|in|sotto)\s+(?:i |gli |le |la |il |l )?(.+)$/),group=mv?categoryItems(mv[2]!,refs):[],dish=mv&&group.length?findDishes(mv[1]!,refs):[];if(dish.length===1&&!dish.some(d=>group.some(g=>g.id===d.id))&&new Set(group.map(g=>g.sectionId)).size===1&&!/\d/.test(low))created=[{kind:'move',id:dish[0]!.id,sectionId:group[0]!.sectionId!}];else if(dish.length&&!dish.some(d=>group.some(g=>g.id===d.id)))return capabilityText(['categories'])}
  if(/\b(?:metti|porta|cambia|imposta)\b.*\btutt[ieoa] (?:i |le |gli |il )?\S.* a \d/.test(low)&&!/\b(?:promo\w*|offert\w*|scont\w*|evidenza|piccant\w*|etichett\w*|ultime|porzion\w*|finit\w*|esaurit\w*|disponibil\w*)\b/.test(low))return capabilityText(['bulk'])
  if(/\b(?:aument\w*|abbass\w*|alz\w*|ritocc\w*|diminuisc\w*)\b.*\btutt[ieoa]\b|\btutt[ieoa]\b.*\b(?:aument\w*|abbass\w*|alz\w*|ritocc\w*|diminuisc\w*)\b/.test(low))return capabilityText(['bulk'])
  // Fase B: «che piatti ho nei secondi?», «cosa c'è nei dolci?»: l'elenco della categoria.
  {const ls=low.match(/^(?:che|quali|cosa) (?:piatti |cose )?(?:ho|ci sono|abbiamo|avete|c e|ce)\s+(?:nei|negli|nelle|nella|nel|tra|fra|in)\s+(?:i |gli |le |la |il )?(.+?)$/);if(ls){const sec=sections.filter(x=>sameSection(x.name,ls[1]!));if(sec.length===1){const items=refs.filter(r=>r.sectionId===sec[0]!.id);if(items.length)return readText({type:'read',read:'items',ids:items.slice(0,10).map(r=>r.id)},refs)}}}
  const listOf=low.match(/^(?:che|quali) (\w+) (?:ci sono|abbiamo|avete|ho|ce)$/)
  if(listOf){const items=categoryItems(listOf[1]!,refs);if(items.length)return readText({type:'read',read:'items',ids:items.slice(0,10).map(r=>r.id)},refs)}}
 const bulkSale=parseSalesText(text),bulk=!!bulkSale&&(bulkSale.kind==='multi'||bulkSale.kind==='tagsOff'||('all' in bulkSale&&!!bulkSale.all))
 if(!planned&&!pending&&!choice&&!created&&!bulk&&isCompoundMessage(text,refs))return{llm:true};
 let actions:MenuAction[],planAfter:Extract<MenuPlan,{type:'change'}>['after']=undefined;if(planned){if(planned.revision!==row.revision||planned.proposalRevision!==undefined&&planned.proposalRevision!==JSON.stringify(proposal?.command??null))return copy.menuChanged;const plan=planned.plan
  // QA 17/10, caso 3: chiarimento con un'azione già capita → proposta «choose»: la risposta «X» la applica (10 minuti).
  if(plan.type==='clarify'&&plan.actions?.length===1&&!proposal){const a=plan.actions[0]!,template=choiceTemplate(a),options=[...new Set([...('id' in a?[a.id]:[]),...plan.ids])].filter(id=>refs.some(r=>r.id===id)&&!st.exclude.some(e=>e.id===id)).slice(0,8)
   if(template&&options.length>1){await propose(tx,ctx,row.revision,{kind:'choose',action:template,options});return fill(copy.choose,{opzioni:options.map((id,i)=>`${i+1}. *${itemLabel(refs.find(r=>r.id===id)!,refs)}*`).join('\n')})}}
  // 17/10 (A4.3): piatto nuovo con un pezzo mancante capito dall'IA → bozza come nel percorso deterministico: la risposta
  // («12», «nei primi») la completa, e la domanda cita solo ciò che il titolare ha detto (prima: «Rimandami la richiesta completa»).
  if(plan.type==='missing'&&plan.name&&!proposal){const c=parseCreate(text,sections,startsWithCreate(text)),one=c&&c.price!==null&&!createCompound(text)?c.price:null,d:CreateDraft={kind:'create_draft',name:plan.name.charAt(0).toLocaleUpperCase('it')+plan.name.slice(1),price:one,sectionId:sections.length===1?sections[0]!.id:c?.sectionId??null}
   await propose(tx,ctx,row.revision,d);return createQuestion(d,sections)}
  if(plan.type!=='change')return planText(plan,refs,sections);if(!storedActions({kind:'batch',actions:plan.actions},refs,sections))return copy.notUnderstood;actions=batch?mergeMenuActions(batch,plan.actions,plan.remove):plan.actions;planAfter=plan.after}
 else{let picked:MenuAction[]|null=created;if(!picked&&choice){const options=choice.options.map(id=>refs.find(r=>r.id===id)).filter((r):r is MenuRef=>!!r)
   // Una risposta che è già un comando completo («carbonara 10») vale come comando nuovo: mai il valore vecchio in sospeso.
   const t1=normalizeMenuText(text).replace(/[^a-z0-9]+/g,' ').trim(),fresh=parseMenuCommand(text)||(()=>{const i=parseIntent(text);return !!i&&i.kind!=='ask'&&i.kind!=='read'&&i.kind!=='capability'})()||/\d/.test(t1)&&/[a-z]{3}/.test(t1)&&!/^(?:il |la |l )?(?:numero )?\d{1,2}$/.test(t1)
   if(!fresh&&allOptions(text,options.length))picked=options.map(r=>({...choice.action,id:r.id}) as MenuAction)
   else{const target=fresh?null:resolveChoice(text,options);if(target)picked=[{...choice.action,id:target.id} as MenuAction]
   // Risposta che non è tra le opzioni (caso 3): niente scelta silenziosa, si chiede di ripetere la richiesta.
   else if(!fresh){const answer=looksLikeAnswer(text,refs);if(answer){await tx.execute(sql`DELETE FROM tako_whatsapp_proposals WHERE phone=${phone}`);return fill(copy.chooseInvalid,{nome:safe(answer)})}
    const t0=normalizeMenuText(text).replace(/[^a-z0-9]+/g,' ').trim();if(t0&&!/\d/.test(t0)&&t0.split(' ').length<=5&&!findDishes(text,refs).length&&!parseIntent(text)&&!wantsCreateText(text))return copy.chooseAgain}}}
  const command=parseMenuCommand(text)
  if(!picked&&!command&&pending){const matches=dishMatches(text,refs);if(matches.length!==1)return matches.length>1?fill(copy.sameName,{opzioni:bold(matches.map(r=>itemLabel(r,refs))),esempio:itemLabel(matches[0]!,refs)}):{llm:true,photo:{mediaUrl:pending.mediaUrl,mediaType:pending.mediaType,...(pending.url?{url:pending.url}:{})}};picked=[{kind:'image',id:matches[0]!.id,mediaUrl:pending.mediaUrl,mediaType:pending.mediaType,...(pending.url?{url:pending.url}:{})}]}
  if(!picked){if(isThanks(text))return copy.thanks
   // F3+F4: promo e scarsità prima di parseIntent («togli la promo…» non è «nascondi»).
   if(!command&&parseSalesText(text)){const settings=await restaurantSettings(),sale=salesTurn(text,workspace,refs,businessDate((settings[0]?.settings as any)?.timezone));if(sale&&'reply' in sale)return sale.reply;if(sale&&'choose' in sale){await propose(tx,ctx,row.revision,{kind:'choose',action:sale.choose.template,options:sale.choose.options.map(r=>r.id)});return fill(copy.choose,{opzioni:sale.choose.options.map((r,i)=>`${i+1}. *${itemLabel(r,refs)}*`).join('\n')})}if(sale)picked=sale.actions}
  }
  if(!picked){const capability=capabilityFromText(text);if(capability)return capabilityText(capability)
   const intent:Intent|null=command?(command.kind==='price'?{kind:'price',target:command.name,price:command.price}:{kind:command.kind,target:command.name,value:command.value}):parseIntent(text)
   if(!intent){const parts=compoundIntents(text,refs);if(!parts){const bare=bareDish(text,refs);if(bare.length&&bare.length<=6)return readText({type:'read',read:'items',ids:bare.map(r=>r.id)},refs);return{llm:true}}picked=parts.map(({intent:i,ref})=>(i.kind==='price'?{kind:'price',id:ref.id,price:i.price}:i.kind==='description'?{kind:'description',id:ref.id,text:i.text}:i.kind==='tag'?{kind:'tag',id:ref.id,tag:i.tag,value:true}:{kind:i.kind,id:ref.id,value:i.value}) as MenuAction)}
   else{
   if(intent.kind==='read')return readText({type:'read',read:intent.read},refs);if(intent.kind==='capability')return capabilityText(intent.ids)
   const bareTarget=normalizeMenuText(intent.target).replace(/^(?:il|lo|la|l|i|gli|le)\s+/,'').replace(/[^a-z0-9]+/g,' ').trim(),matches=refs.filter(r=>normalizeMenuText(r.name).replace(/[^a-z0-9]+/g,' ').trim()===(command?normalizeMenuText(intent.target).replace(/[^a-z0-9]+/g,' ').trim():bareTarget));const found=matches.length===1?matches:findDishes(intent.target,refs)
   if(intent.kind==='ask')return found.length?readText({type:'read',read:'items',ids:found.slice(0,6).map(r=>r.id)},refs):fill(copy.notFoundNamed,{nome:shown(intent.target)})
   // G1: mai «Non trovo «<frase>»» con un nome lungo o con verbi: si passa all'IA (che il validatore controlla).
   const phrase=intent.target.trim().split(/\s+/).length>4||/\b(aggiung\w*|inserisc\w*|metti\w*|cambia|costa|costano|euro|prezzo|finit\w*|esaurit\w*|nascondi|togli|promo\w*|offerta|che)\b/.test(normalizeMenuText(intent.target))
   // Round 2 (B): «la pizza», «il dolce» = nome di una categoria con più piatti → si chiede quale, mai l'unico piatto che contiene la parola.
   const catItems=categoryWordItems(intent.target,refs);if(catItems){const options=catItems.slice(0,8),template0:ChoiceAction=intent.kind==='price'?{kind:'price',price:intent.price}:intent.kind==='description'?{kind:'description',text:intent.text}:intent.kind==='tag'?{kind:'tag',tag:intent.tag,value:true}:{kind:intent.kind,value:intent.value};await propose(tx,ctx,row.revision,{kind:'choose',action:template0,options:options.map(r=>r.id)});return fill(copy.choose,{opzioni:options.map((r,i)=>`${i+1}. *${itemLabel(r,refs)}*`).join('\n')})}
   // «il menù costa 16»: il bersaglio è fatto solo di parole comuni («menu», «piatto»); se dei piatti le contengono si chiede quale.
   if(!found.length&&!words(intent.target).length){const toks=normalizeMenuText(intent.target).replace(/[^a-z0-9]+/g,' ').trim().split(' ').filter(w=>w.length>=3&&!['del','della','dello','dei','degli','delle','una','uno'].includes(w)),cands=toks.length?refs.filter(r=>{const n=normalizeMenuText(r.name).replace(/[^a-z0-9]+/g,' ').split(' ');return toks.every(w=>n.includes(w))}).slice(0,8):[]
    if(cands.length){const t0:ChoiceAction=intent.kind==='price'?{kind:'price',price:intent.price}:intent.kind==='description'?{kind:'description',text:intent.text}:intent.kind==='tag'?{kind:'tag',tag:intent.tag,value:true}:{kind:intent.kind,value:intent.value};await propose(tx,ctx,row.revision,{kind:'choose',action:t0,options:cands.map(r=>r.id)});return fill(copy.choose,{opzioni:cands.map((r,i)=>`${i+1}. *${itemLabel(r,refs)}*`).join('\n')})}}
   if(!found.length&&st.brain)return{llm:true}
   // A5 (17/10): bersaglio non trovato (e niente da passare all'IA) ma che «suona» come un piatto del menu («kenesac», «Bu»):
   // domanda con l'ipotesi al posto di «Non trovo», mai una scrittura diretta senza il cervello. Più ipotesi vicine → scelta.
   if(!found.length&&!phrase&&!(preselect(text,refs).length&&!command)){const ph=phoneticCandidates(intent.target,refs);if(ph.length){const t0:ChoiceAction=intent.kind==='price'?{kind:'price',price:intent.price}:intent.kind==='description'?{kind:'description',text:intent.text}:intent.kind==='tag'?{kind:'tag',tag:intent.tag,value:true}:{kind:intent.kind,value:intent.value}
    const hold:Hold=ph.length===1?{kind:'hold',actions:[],asks:[{type:'confirm',word:shown(intent.target),action:{...t0,id:ph[0]!.id} as MenuAction}]}:{kind:'hold',actions:[],asks:[{type:'choose',word:shown(intent.target),options:ph.map(r=>r.id),template:t0 as any}]}
    await propose(tx,ctx,row.revision,hold);return holdQuestion(hold,refs,sections)}}
   if(!found.length)return (preselect(text,refs).length&&!command)||phrase?{llm:true}:fill(copy.notFoundNamed,{nome:shown(intent.target)})
   const template:ChoiceAction=intent.kind==='price'?{kind:'price',price:intent.price}:intent.kind==='description'?{kind:'description',text:intent.text}:intent.kind==='tag'?{kind:'tag',tag:intent.tag,value:true}:{kind:intent.kind,value:intent.value}
   if(found.length>1){const only=exactPick(intent.target,found);if(only)found.splice(0,found.length,only)}
   // Cervello acceso: prima di chiedere «quale?» per un nome che combacia con più piatti decide il cervello (con i controlli del
   // validatore): «il caffè macchiato», «la tagliata» col tagliere nel menu non sono ambigui per chi legge la frase intera.
   if(found.length>1&&!opts.brainOff&&!choice&&botBrainEnabled((await restaurantSettings())[0]?.settings))return{llm:true,brain:true}
   if(found.length>1){const options=found.slice(0,8);await propose(tx,ctx,row.revision,{kind:'choose',action:template,options:options.map(r=>r.id)});return fill(copy.choose,{opzioni:options.map((r,i)=>`${i+1}. *${itemLabel(r,refs)}*`).join('\n')})}
   picked=[{...template,id:found[0]!.id} as MenuAction]}}
  actions=picked}
 const preUndoLen=preUndo.length;if(preUndo.length)actions=[...preUndo,...actions]
 // Mai cambiare un piatto negato (caso 2), da qualunque percorso arrivi l'azione.
 if(st.exclude.length){actions=actions.filter(a=>!isExcluded(a as any,st.exclude));if(!actions.length){if(batch)return copy.pendingEmpty;return fill(copy.negatedOnly,{piatti:[...new Set(st.exclude.map(e=>refs.find(r=>r.id===e.id)?.name).filter((n):n is string=>!!n))].slice(0,4).map(safe).join(', ')})}}
 {const problem=salesActionProblem(actions,workspace);if(problem)return problem}
 actions=effectiveMenuActions(actions,workspace);
 // A4.4: la risposta alla domanda dello stesso messaggio segue la modifica (letta sul menu dopo il salvataggio).
 const afterText=(w:Workspace)=>planAfter?'\n\n'+planText(planAfter,catalogOf(w).refs,sections):''
 if(!actions.length){if(batch||holdPick)await tx.execute(sql`DELETE FROM tako_whatsapp_proposals WHERE phone=${phone}`);return batch?copy.pendingEmpty:copy.noChanges+afterText(workspace)}
 // G6: prezzo implausibile (oltre 500 € o almeno 8 volte quello attuale: lo zero in più; round 2: 3× bloccava prezzi veri) → conferma scritta, mai online diretto.
 const implausible=actions.some(a=>(a.kind==='price'||a.kind==='create'||a.kind==='special')&&(a.price>500||(a.kind==='price'&&(()=>{const r=refs.find(x=>x.id===a.id);return !!r&&r.price>0&&a.price>=8*r.price})())))
 // Fase B: eliminare chiede SEMPRE conferma («Elimino X dal menu? Rispondi sì»), anche da sola.
 const needsApproval=!!batch||actions.length>3||implausible||actions.some(a=>a.kind==='delete'&&!a.undoCreate);
 // «elimina/cancella/rimuovi X»: nascosto, mai eliminato (17/10); lo si dice una volta nella risposta.
 {const hid=actions.find(a=>a.kind==='hidden'&&a.value);if(hid&&/\brimuov\w*/i.test(normalizeMenuText(text))&&!DELETE_VERB.test(normalizeMenuText(text).replace(/[^a-z0-9]+/g,' '))&&'id' in hid){const r=refs.find(x=>x.id===hid.id);if(r)tail=[tail,fill(copy.hiddenNotDeletedPlain,{piatto:safe(r.name).toLowerCase()})].filter(Boolean).join('\n\n')}}
 const withTail=(s:string)=>tail?s+'\n\n'+tail:s
 if(needsApproval){await propose(tx,ctx,row.revision,{kind:'batch',actions,requiresTypedOk:true});const restaurant=await tx.execute(sql`SELECT name FROM restaurants WHERE id=${tenant}`);return withTail(proposalText(String(restaurant[0]?.name),actions,refs,sections)+afterText(workspace))}
 const photos=actions.filter((a):a is Extract<MenuAction,{kind:'image'}>=>a.kind==='image'),ready=new Map<string,string>([...photos.flatMap(a=>a.url&&storedUpload(tenant,a.url)?[[a.id,a.url] as [string,string]]:[]),...(uploads??[])]);
 if(photos.some(a=>!ready.has(a.id))){await propose(tx,ctx,row.revision,{kind:'batch',actions,autoApply:true});return{upload:photos.filter(a=>!ready.has(a.id))}}
 const waItems=new Map(workspace.menus.flatMap(m=>m.sections.flatMap(sec=>sec.items.map(i=>[i.id,structuredClone(i)] as const)))),memo=actions.slice(preUndoLen),undo=undoFor(memo,id=>waItems.get(id) as any);
 const beforeW=structuredClone(workspace),restaurant=await restaurantSettings();applyActions(workspace,actions,{uploads:ready,timezone:String((restaurant[0]?.settings as any)?.timezone??'Europe/Rome')});const next=workspaceSchema.parse(workspace);
 if(opts.isExpired?.())throw new Error('WhatsApp turn expired');const saved=await mutateWorkspace(tenant,actor,row.revision,next,false,'WhatsApp: aggiornamento automatico',tx as unknown as DB);if(opts.isExpired?.())throw new Error('WhatsApp turn expired');await mutateWorkspace(tenant,actor,saved.revision,next,true,'WhatsApp: pubblicazione automatica',tx as unknown as DB);if(opts.isExpired?.())throw new Error('WhatsApp turn expired');await tx.execute(sql`DELETE FROM tako_whatsapp_proposals WHERE phone=${phone}`);if(st.postDraft)await propose(tx,ctx,saved.revision+1,st.postDraft);await rememberRenames(tx,tenant,actions,refs,(await restaurantSettings())[0]?.settings);await writeLast(tx,phone,!reverted&&undo&&(memo.length===1||memo.every(a=>a.kind==='promo'||a.kind==='scarcity'||a.kind==='tag'))?{kind:'last',actions:memo,undo,revision:saved.revision+1,at:Date.now()}:null);await writeUndo(tx,phone,undoRecordFor(beforeW,next));if(st.brain)await trackChange(tx,phone,undoRecordFor(beforeW,next));return withTail(appliedMenuText(actions,refs,sections)+afterText(next)+(st.postDraft?'\n\n'+createQuestion(st.postDraft,catalogOf(next).sections):''))
}
/** Fase B (B3.2): dopo «rinomina boh in Bollito» il vecchio nome resta un alias del piatto nella memoria del ristorante
 * (solo col cervello acceso), così «boh» continua a funzionare. Mai verso un nome che è di un altro piatto. */
async function rememberRenames(tx:Tx,tenant:string,actions:MenuAction[],refs:MenuRef[],settings:unknown){
 const ren=actions.filter((a):a is Extract<MenuAction,{kind:'rename'}>=>a.kind==='rename');if(!ren.length||!botBrainEnabled(settings))return
 try{const store=sqlBrainStore(tx),now=Date.now();for(const a of ren){const old=refs.find(r=>r.id===a.id);if(!old)continue;const phrase=plainName(old.name);if(!phrase||refs.some(r=>r.id!==a.id&&plainName(r.name)===phrase))continue
  await store.saveMemory({id:randomUUID(),restaurantId:tenant,phrase,kind:'alias',itemId:a.id,meaning:a.name,state:'active',confirmations:2,uses:0,lastUsedAt:now,origin:'owner',createdAt:now,updatedAt:now})
  await store.log(tenant,{memoryId:null,phrase,op:'create',itemId:a.id,detail:{motivo:'rinomina'}})}}catch{/* la memoria non deve mai rompere la risposta */}}
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
 // 17/10: un avviso del turno deterministico (richiesta in sospeso scartata) arriva anche quando decide l'IA.
 const note='llm' in turn?turn.note:undefined,r=await resolveTurnCore(ctx,text,turn,key,ai,budget);return note&&r?r+'\n\n'+note:r}
async function resolveTurnCore(ctx:Ctx,text:string,turn:Exclude<Turn,string>,key:string,ai:GroqOptions={},budget:Budget={expired:false}):Promise<string>{
 if('upload' in turn){const uploads=new Map<string,string>()
  for(const a of turn.upload){const saved=await prepareUpload(ctx.tenant,{mediaUrl:a.mediaUrl})
   if('error' in saved)return fill(copy.photoUploadFailed,{motivo:saved.error.replace(/\.$/,'').toLowerCase()});uploads.set(a.id,saved.url)}
  if(budget.expired)return ''
  try{const done=await turnFor(ctx,'conferma',{uploads,isExpired:()=>budget.expired});return typeof done==='string'?done:copy.failed}catch{return copy.photoPublishFailed}}
 if(!key)return copy.noAi;const row=await readWorkspace(ctx.tenant);if(!row)throw new Error('Workspace missing');const {refs,sections}=catalogOf(workspaceSchema.parse(row.draft))
 if(turn.photo){const candidates=candidatesFor(text,refs);if(!candidates.length)return fill(copy.photoNotFound,{nome:text.slice(0,80)});const pick=validateDishPick((await groqDishPick(text,candidates,key,[],ai)).content,refs);if(pick.type==='clarify')return pick.ids.length?fill(copy.photoWhich,{opzioni:bold(pick.ids.map(id=>itemLabel(refs.find(r=>r.id===id)!,refs)))}):fill(copy.photoNotFound,{nome:text.slice(0,80)})
  if(budget.expired)return '';const done=await turnFor(ctx,text,{isExpired:()=>budget.expired,planned:{revision:row.revision,plan:{type:'change',actions:[{kind:'image',id:pick.id,...turn.photo}]}}});return typeof done==='string'?done:'upload' in done?await resolveTurn(ctx,text,done,key,ai,budget):copy.failed}
 if(turn.fullmenu){let extraction:FullMenuExtraction;try{extraction=await extractFullMenu(turn.fullmenu.text,key,fullMenuFetcher())}catch(error){if(error instanceof OnboardingBusy)return copy.busy;return fullMenuCopy.failed}
  if(budget.expired)return '';const done=await turnFor(ctx,turn.fullmenu.text,{voice:turn.fullmenu.voice,isExpired:()=>budget.expired,plannedFull:{revision:row.revision,job:turn.fullmenu,extraction}});return typeof done==='string'?done:copy.failed}
 if(turn.text)text=turn.text;const exclude=turn.exclude??[]
 if(turn.brain){const pend=(await db.execute(sql`SELECT command,revision FROM tako_whatsapp_proposals WHERE phone=${ctx.phone} AND actor_id=${ctx.actor} AND restaurant_id=${ctx.tenant} AND expires_at>now()`))[0]?.command??null
  const name=String((await db.execute(sql`SELECT name FROM restaurants WHERE id=${ctx.tenant}`))[0]?.name??'')
  const run=text.length<=30000&&refs.length<=1500?await brainPlan(db,{tenant:ctx.tenant,phone:ctx.phone,restaurantName:name,text,refs,sections,pendingCommand:pend,key,ai,exclude,undo:await (async()=>{const a=await readRestorable(db,ctx.phone),b=await readUndo(db,ctx.phone),items=[...(a?.items??[])];for(const i of b&&Date.now()-Number(b.at)<=30*60*1000?b.items:[])if(!items.some(x=>x.id===i.id))items.push({id:i.id,before:i.before});return items.length?{at:Date.now(),items}:null})()}):null
  if(budget.expired)return ''
  // Riserva: Groq giù / quota / JSON non valido → il turno di oggi, identico (deterministico e poi la vecchia chiamata IA).
  if(!run){const done=await turnFor(ctx,text,{brainOff:true,isExpired:()=>budget.expired});return typeof done==='string'?done:await resolveTurnCore(ctx,text,'llm' in done?{...done,brain:undefined,noBrain:true} as any:done,key,ai,budget)}
  const d=run.decision
  if(d.intent==='chat'&&d.plan.type==='clarify'&&!d.plan.ids.length)return composeReply(d,refs,sections)
  // Rimando senza contesto valido («anche la gricia», «no scusa 14» dopo 30 minuti): una domanda, non «non ho capito».
  // Un solo piatto e nessuna azione capita: una domanda («Cosa vuoi cambiare per X?»), non «non ho capito».
  if(!d.hold&&d.plan.type==='clarify'&&d.plan.ids.length===1&&!d.plan.actions?.length){const r=refs.find(x=>x.id===(d.plan as any).ids[0]);if(r)return fill(copy.brainWhatFor,{piatto:safe(r.name)})}
  if(!d.hold&&d.plan.type==='clarify'&&!d.plan.ids.length&&!d.plan.actions?.length&&(REFERS.test(normalizeMenuText(text).replace(/[^a-z0-9]+/g,' '))||(!!run.recentIds?.length&&normalizeMenuText(text).trim().split(/\s+/).length<=4))){const names=(run.recentIds??[]).map(id=>refs.find(r=>r.id===id)?.name).filter((n):n is string=>!!n).map(n=>'*'+safe(n)+'*');return names.length===1?fill(copy.brainWhatFor,{piatto:names[0]!.replace(/^\*|\*$/g,'')}):names.length?fill(copy.brainWhichRecent,{piatti:names.length>1?names.slice(0,-1).join(', ')+' o '+names.at(-1):names[0]!}):copy.brainNoContext}
  // Più parti incerte: parti chiare in sospeso (proposta `hold`, 10 minuti) e una domanda per ciascuna, in un solo messaggio.
  if(d.hold){const hold=d.hold;return db.transaction(async tx=>{await lock(tx,ctx.phone);const live=await readWorkspace(ctx.tenant,tx);if(!live||live.revision!==row.revision)return copy.menuChanged;await tx.execute(sql`DELETE FROM tako_whatsapp_proposals WHERE phone=${ctx.phone}`);await propose(tx,ctx,row.revision,hold);return holdQuestion(hold,refs,sections)})}
  const done=await turnFor(ctx,text,{isExpired:()=>budget.expired,planned:{revision:row.revision,plan:d.plan,proposalRevision:JSON.stringify(pend)},exclude:[...exclude,...d.exclude]})
  if(typeof done==='string'){if(d.plan.type==='change'&&/Confermato/.test(done))await trackChange(db,ctx.phone,await readUndo(db,ctx.phone))
   if(d.plan.type==='change')inBackground(learnAfter(db,{tenant:ctx.tenant,refs,sections,run,applied:/Confermato/.test(done),key,meter:ai.meter}));return done}
  return 'upload' in done?await resolveTurn(ctx,text,done,key,ai,budget):copy.notUnderstood}
 const pendingRows=await db.execute(sql`SELECT command,revision FROM tako_whatsapp_proposals WHERE phone=${ctx.phone} AND actor_id=${ctx.actor} AND restaurant_id=${ctx.tenant} AND expires_at>now()`),pendingCommand=pendingRows[0]?.command,pending=storedActions(pendingCommand,refs,sections);
 // Reject oversize requests explicitly rather than applying a truncated transcript/catalog.
 if(text.length>30000||refs.length>1500)return 'La richiesta è *troppo lunga*. Non ho cambiato nulla. Dividila in più messaggi.';
 const candidates=refs,raw=pending?validatePendingMenuPlan((await groqPendingMenuPlan(text,refs,key,sections,pending,ai)).content,refs,sections,text,pending):validateMenuPlan((await groqMenuPlan(text,candidates,key,wantsCreateText(text)?sections:[],ai)).content,refs,{sections,message:text,exclude}),plan:MenuPlan=!candidates.length&&raw.type==='capability'&&!raw.ids.includes('all')&&!looksLikeQuestion(text)?{type:'clarify',ids:[]}:raw;if(budget.expired)return '';const done=await turnFor(ctx,text,{isExpired:()=>budget.expired,planned:{revision:row.revision,plan,proposalRevision:JSON.stringify(pendingCommand??null)},exclude});return typeof done==='string'?done:'upload' in done?await resolveTurn(ctx,text,done,key,ai,budget):copy.notUnderstood
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
async function runJob(kind:'audio'|'text'|'image',ctx:Ctx,sid:string,body:string,form:Record<string,string>,lead=''){
 const budget:Budget={expired:false};let timer:ReturnType<typeof setTimeout>|undefined
 const timeout=new Promise<string>(resolve=>{timer=setTimeout(()=>{budget.expired=true;resolve(kind==='image'?copy.photoTimeout:copy.jobTimeout)},jobTimeoutMs())})
 let message=await Promise.race([jobMessage(kind,ctx,body,form,budget).catch(error=>{if(error instanceof WorkspaceTrialLocked)return error.message;budget.failed=true;return kind==='image'?copy.photoDownload:copy.failed}),timeout]).finally(()=>clearTimeout(timer))
 const problem:FailureKind|null=budget.expired?'job_timeout':budget.failed?'job_failed':null
 if(!message){if(problem)await reportFailure({kind:problem,tenant:ctx.tenant,phone:ctx.phone,detail:kind});return}if(lead)message=lead+message;const accountSid=process.env.TWILIO_ACCOUNT_SID||'',token=process.env.TWILIO_AUTH_TOKEN||'',from=process.env.TWILIO_WHATSAPP_NUMBER||''
 try{await sendWhatsApp(accountSid,token,from,ctx.phone,message)}catch{await new Promise(r=>setTimeout(r,1500));try{await sendWhatsApp(accountSid,token,from,ctx.phone,message)}catch(error){await reportFailure({kind:'send_failed',tenant:ctx.tenant,phone:ctx.phone,detail:error instanceof Error?error.message:'Error'});return}}
 await db.execute(sql`UPDATE tako_whatsapp_messages SET response=${sent+message} WHERE sid=${sid}`)
 if(problem)await reportFailure({kind:problem,tenant:ctx.tenant,phone:ctx.phone,detail:kind})
}
// 17/10: nomi di piatti e categorie del locale nel `prompt` di Whisper (nessun token LLM in più). Errore → parole di servizio.
async function whisperVocab(tenant:string):Promise<string>{try{const row=await readWorkspace(tenant);if(!row)return '';const c=catalogOf(workspaceSchema.parse(row.published??row.draft));return whisperPrompt(c.refs,c.sections)}catch{return ''}}
async function jobMessage(kind:'audio'|'text'|'image',ctx:Ctx,body:string,form:Record<string,string>,budget:Budget):Promise<string>{
 const key=process.env.GROQ_API_KEY||'',accountSid=process.env.TWILIO_ACCOUNT_SID||'',token=process.env.TWILIO_AUTH_TOKEN||'';let text=body,prefix='',response:string
 const ai:GroqOptions={meter:recordUsage,onWait:()=>quietPhones.has(ctx.phone)?undefined:sendWhatsApp(accountSid,token,process.env.TWILIO_WHATSAPP_NUMBER||'',ctx.phone,copy.wait).catch(()=>{})}
 try{if(kind==='image'){if(Number(form.NumMedia)>1)prefix=copy.photoFirstOnly;const media=await downloadTwilioMedia(form.MediaUrl0||'',accountSid,token),problem=photoProblem(media.bytes,media.type||form.MediaContentType0||'');const photo={mediaUrl:form.MediaUrl0||'',mediaType:media.type}
   if(problem)response=problem;else{const turn=await db.transaction(async tx=>{await lock(tx,ctx.phone);const live=await linkedContext(tx,ctx.phone);if(!live)return '';await propose(tx,live,0,{kind:'photo',...photo});return text?menuTurn(tx,live,text,{isExpired:()=>budget.expired}):copy.photoAsk});response=typeof turn==='string'?turn:await resolveTurn(ctx,text,turn,key,ai,budget);if(response&&!budget.expired)response=await attachPhoto(ctx,{...photo,bytes:media.bytes,type:media.type},budget).catch(()=>null)??response}}
  else{if(kind==='audio'){if(!key)throw new Error('AI not configured');const [media,vocab]=await Promise.all([downloadTwilioMedia(form.MediaUrl0||'',accountSid,token),whisperVocab(ctx.tenant)]);text=await transcribeAudio(media.bytes,/^audio\//i.test(media.type)?media.type:whatsappAudioType(form.MediaContentType0,form.Body)||media.type,key,ai,vocab)}
   if(kind==='audio'&&!text)response=copy.voiceEmpty;else{if(kind==='audio'){
    prefix='';
    if(process.env.TAKO_WHATSAPP_ONBOARDING_ENABLED==='1'&&!budget.expired){
     const {onboardingTransport,queueOnboardingChat}=await import('../lib/onboarding-chat.js');const agency=await onboardingTransport(ctx.phone,text);
     if(agency){await queueOnboardingChat(agency.actor,ctx.phone,form.MessageSid!,text,{...form,OnboardingVoice:'1',NumMedia:'0'});return ''}
    }
   }if(budget.expired)return '';const turn=await turnFor(ctx,text,{voice:kind==='audio',isExpired:()=>budget.expired});response=typeof turn==='string'?turn:await resolveTurn(ctx,text,turn,key,ai,budget)}}
 }catch(error){if(!(error instanceof GroqBusy))budget.failed=true;response=error instanceof GroqBusy?copy.busy:kind==='audio'&&!prefix?copy.voiceFailed:kind==='image'?copy.photoDownload:copy.failed}
 if(response&&kind!=='image'&&!budget.expired)await rememberTurn(db,ctx.tenant,ctx.phone,text,prefix+response)
 return response?prefix+response:''
}
export async function twilioMenuRoutes(app:FastifyInstance){
 app.get('/menu-workspace/whatsapp',{preHandler:requireRole('owner')},async req=>{const rows=await db.execute(sql`SELECT phone FROM tako_whatsapp_links WHERE restaurant_id=${req.user.restaurantId} AND actor_id=${req.user.id}`);return{data:{configured:!!process.env.TWILIO_AUTH_TOKEN,sender:process.env.TWILIO_WHATSAPP_NUMBER?.replace('whatsapp:','')||null,numbers:rows.map(r=>String(r.phone).replace('whatsapp:',''))}}})
 app.post('/menu-workspace/whatsapp/code',{preHandler:requireRole('owner')},async(req,reply)=>{if(!process.env.TWILIO_AUTH_TOKEN)return reply.code(503).send({error:{message:'Canale Twilio non configurato'}});const code=randomBytes(12).toString('hex');await db.transaction(async tx=>{await tx.execute(sql`DELETE FROM tako_whatsapp_codes WHERE actor_id=${req.user.id} AND restaurant_id=${req.user.restaurantId}`);await tx.execute(sql`INSERT INTO tako_whatsapp_codes(code_hash,restaurant_id,actor_id,expires_at) VALUES(${digest(code)},${req.user.restaurantId},${req.user.id},now()+interval '15 minutes')`)});return{data:{code,sender:process.env.TWILIO_WHATSAPP_NUMBER?.replace('whatsapp:',''),message:'collega tako '+code,expiresInMinutes:15}}})
 app.post('/menu-workspace/whatsapp/disconnect',{preHandler:requireRole('owner')},async req=>{await db.transaction(async tx=>{await tx.execute(sql`DELETE FROM tako_whatsapp_proposals WHERE restaurant_id=${req.user.restaurantId} AND actor_id=${req.user.id}`);await tx.execute(sql`DELETE FROM tako_whatsapp_links WHERE restaurant_id=${req.user.restaurantId} AND actor_id=${req.user.id}`);await tx.execute(sql`DELETE FROM tako_whatsapp_codes WHERE restaurant_id=${req.user.restaurantId} AND actor_id=${req.user.id}`)});return{data:{disconnected:true}}})
 // WhatsApp del titolare (agenzia o titolare del locale, verificato qui): un locale = un telefono, un telefono = un locale.
 // Salvare crea un pre-collegamento (activated_at NULL), senza codici né messaggi in uscita; il primo messaggio di quel numero lo attiva.
 const ownerDenied=(reply:any)=>reply.code(403).send({error:{code:'FORBIDDEN',message:'Solo l\'agenzia o il titolare del locale possono gestire il WhatsApp del titolare.'}})
 const ownerState=async(tx:Tx,tenant:string)=>{const rows=await tx.execute(sql`SELECT phone,activated_at FROM tako_whatsapp_links WHERE restaurant_id=${tenant} ORDER BY created_at DESC LIMIT 1`),row=rows[0];return{configured:!!process.env.TWILIO_AUTH_TOKEN,sender:process.env.TWILIO_WHATSAPP_NUMBER?.replace('whatsapp:','')||null,phone:row?String(row.phone).replace('whatsapp:',''):null,status:row?(row.activated_at==null?'pending':'linked'):null,activatedAt:row?.activated_at?new Date(row.activated_at as string|Date).toISOString():null}}
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
 const phone=form.From||'',sid=form.MessageSid||'',body=(form.Body||'').trim(),media=Number(form.NumMedia||0);if(form.TakoSyncTest==='1'){quietPhones.add(phone);setTimeout(()=>quietPhones.delete(phone),120000)}if(!/^whatsapp:\+\d{8,15}$/.test(phone)||!(/^SM[a-f0-9]{32}$/i.test(sid)||linked.length>0&&/^MM[a-f0-9]{32}$/i.test(sid))||body.length>2000)return reply.code(400).send('Invalid message');
 const scope:{tenant?:string,cached?:boolean}={};const result=await db.transaction(async tx=>{await lock(tx,phone);const cached=await tx.execute(sql`SELECT response FROM tako_whatsapp_messages WHERE sid=${sid}`);if(cached.length){scope.cached=true;const text=String(cached[0]!.response);return text.startsWith(sent)?'':text}
 const answer=async(text:string)=>{await tx.execute(sql`INSERT INTO tako_whatsapp_messages(sid,response) VALUES(${sid},${text}) ON CONFLICT DO NOTHING`);return text};
 const pair=body.match(/^collega tako ([a-f0-9]{24})$/i);if(pair){const codes=await tx.execute(sql`DELETE FROM tako_whatsapp_codes WHERE code_hash=${digest(pair[1]!.toLowerCase())} AND expires_at>now() RETURNING restaurant_id,actor_id`);const code=codes[0];if(!code||!await permitted(tx,String(code.actor_id),String(code.restaurant_id)))return answer(copy.codeInvalid);await tx.execute(sql`DELETE FROM tako_whatsapp_proposals WHERE phone=${phone} OR phone IN (SELECT phone FROM tako_whatsapp_links WHERE restaurant_id=${code.restaurant_id})`);await tx.execute(sql`DELETE FROM tako_whatsapp_links WHERE restaurant_id=${code.restaurant_id} AND phone<>${phone}`);await tx.execute(sql`INSERT INTO tako_whatsapp_links(phone,restaurant_id,actor_id,activated_at) VALUES(${phone},${code.restaurant_id},${code.actor_id},now()) ON CONFLICT(phone) DO UPDATE SET restaurant_id=EXCLUDED.restaurant_id,actor_id=EXCLUDED.actor_id,created_at=now(),activated_at=now()`);await discloseOnce(tx,phone);return answer(copy.aiDisclosure+'\n\n'+await welcomeFor(tx,String(code.restaurant_id)))}
 const ctx=await linkedContext(tx,phone);if(!ctx)return answer('');scope.tenant=ctx.tenant
 // Primo messaggio di un numero pre-collegato dalla dashboard: qualunque cosa scriva, si attiva e riceve benvenuto + «cosa sai fare».
 if(ctx.pending){await tx.execute(sql`UPDATE tako_whatsapp_links SET activated_at=now() WHERE phone=${phone} AND activated_at IS NULL`);await tx.execute(sql`DELETE FROM tako_whatsapp_proposals WHERE phone=${phone}`);await discloseOnce(tx,phone);return answer(copy.aiDisclosure+'\n\n'+await welcomeFor(tx,ctx.tenant)+nextMessage+copy.help)}
 if(phone===testFaultPhone&&ctx.tenant===qaTenant&&normalizeMenuText(body)==='guasto di prova')throw new TestFault('Guasto simulato')
 // AI Act (17/10): al primo messaggio di un numero già collegato, una riga «assistente automatico», una volta sola.
 const disclose=await discloseOnce(tx,phone),say=(t:string)=>answer(disclose&&t?copy.aiDisclosure+'\n\n'+t:t),prefix=disclose?copy.aiDisclosure+'\n\n':''
 if(media>0){const type=form.MediaContentType0||'',job=whatsappAudioType(type,body)?'audio' as const:/^image\//i.test(type)?'image' as const:null;if(!job)return say(copy.mediaOnly);await reserve(tx,sid);return{job,ctx,ack:'',prefix}}
 if(!body)return say(copy.help);const turn=await menuTurn(tx,ctx,body);if(typeof turn==='string')return say(turn);if('llm' in turn&&!process.env.GROQ_API_KEY)return say(copy.noAi);await reserve(tx,sid);return{job:'text' as const,ctx,ack:'upload' in turn?prefix+copy.photoWorking:'',prefix:'upload' in turn?'':prefix}}).catch(async error=>{if(error instanceof WorkspaceTrialLocked)return error.message;req.log.error({error:error instanceof Error?error.message.slice(0,80):'Error'},'WhatsApp turn failed');await inBackground(reportFailure({kind:error instanceof TestFault?'test_fault':'webhook_error',tenant:scope.tenant??null,phone,detail:error instanceof Error?error.message:'Error'}));return copy.failed});
 if(typeof result==='string'){if(scope.tenant&&!scope.cached&&result&&body)await rememberTurn(db,scope.tenant,phone,body,result);return reply.type('text/xml; charset=utf-8').header('Cache-Control','no-store').send(twiml(result))}
 // Verifica dal vivo sincrona: solo sul QA e solo con il campo firmato TakoSyncTest=1 (la firma Twilio copre tutti i campi: serve il
 // token). Anche le risposte dell'IA tornano SOLO nel TwiML di questa richiesta, mai via REST, e senza avvisi. Altrimenti nulla cambia.
 if(result.ctx.tenant===qaTenant&&form.TakoSyncTest==='1'){const m=await jobMessage(result.job,result.ctx,body,form,{expired:false}).catch(()=>copy.failed);await db.execute(sql`UPDATE tako_whatsapp_messages SET response=${sent+m} WHERE sid=${sid}`);return reply.type('text/xml; charset=utf-8').header('Cache-Control','no-store').send(twiml((result.ack?result.ack+'\n\n':'')+(m?result.prefix+m:'')))}
 const job=runJob(result.job,result.ctx,sid,body,form,result.prefix).catch(error=>req.log.error({error:error instanceof Error?error.message.slice(0,80):'Error'},'WhatsApp AI job failed')),runtime=(globalThis as any).EdgeRuntime;if(typeof runtime?.waitUntil==='function')runtime.waitUntil(job);else await job
 return reply.type('text/xml; charset=utf-8').header('Cache-Control','no-store').send(twiml(result.ack))
 })
}
