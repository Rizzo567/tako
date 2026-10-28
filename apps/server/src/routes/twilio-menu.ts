import type {FastifyInstance} from 'fastify'
import {db,type DB} from '@tako/db'
import {sql} from 'drizzle-orm'
import {createHash,randomBytes,randomUUID} from 'node:crypto'
import {requireRole} from '../middleware/auth.js'
import {isAgencyUser} from '../lib/agency-access.js'
import {WorkspaceTrialLocked} from '../lib/menu-workspace-store.js'
// dashboard editor 22/10: il bot legge il PUBBLICATO (revisione = published_revision) e pubblica solo la sua modifica (menu-workspace-bot.ts).
import {readBotWorkspace,applyBotChange} from '../lib/menu-workspace-bot.js'
import {inheritPhotos,inheritedNote,photoTargetsByName,groupOf} from '../lib/menu-photo-inherit.js'
import {workspaceSchema,type Workspace} from '../lib/menu-workspace-contract.js'
import {Buffer} from 'node:buffer'
import {stripMenuSuffix,g9DishMentioned,plain,withNewSections,describeAction,priceChoice,effectiveMenuActions,mergeMenuActions,appliedMenuText,groqPendingMenuPlan,validatePendingMenuPlan,validateMenuPlan,groqMenuPlan,groqDishPick,validateDishPick,dishMatches,itemLabel,photoProblem,downscaleSourcePixels,applyActions,planText,welcomeText,safe,localDate,capabilityText,readText,GroqBusy,type GroqOptions,type UsageEvent,downloadTwilioMedia,transcribeAudio,whisperPrompt,sendWhatsApp,proposalText,type MenuRef,type SectionRef,type MenuAction,type MenuPlan} from '../lib/twilio-menu-ai.js'
import {copy,helpWords,fill} from '../lib/twilio-menu-copy.js'
import {createStep,createQuestion,followUp,undoFor,categoryWordItems,revertTarget,groupCommand,type CreateDraft,type LastApplied} from '../lib/twilio-menu-create.js'
import {words,exactPick,politeCommand,spokenDecimals,spokenCents,parseIntent,findDishes,diminutiveRivals,preselect,candidatesFor,resolveChoice,capabilityFromText,isThanks,compoundIntents,looksLikeQuestion,wantsCreateText,wantsSpecialText,isCompoundMessage,type Intent} from '../lib/twilio-menu-nlu.js'
import {validTwilioSignature,shouldHandleInTako,replyIntent,forwardTwilioWebhook,parseMenuCommand,normalizeMenuText,twiml,nextMessage,withMedia,withoutMedia,lateReply,beginWrite,raceDeadline,whatsappAudioType,type MenuCommand} from '../lib/twilio-menu-command.js'
import {reportFailure,inBackground,quietPhones,type FailureKind} from '../lib/twilio-menu-alerts.js'
import {normalizeOwnerPhone,whatsappAddress} from '../lib/whatsapp-phone.js'
import {fullMenuTurn,type FullMenuJob} from '../lib/twilio-menu-fullmenu.js'
import {extractFullMenu,fullMenuFetcher,haikuFullMenuFetcher,type FullMenuExtraction} from '../lib/menu-full-extract.js'
import {OnboardingBusy} from '../lib/onboarding-planner.js'
import {presetChatCommand} from '../lib/menu-preset-target.js'
import {fullMenuCopy} from '../lib/twilio-menu-copy.js'
import {parseSalesText,salesTurn,salesActionProblem,categoryItems,type SalesTemplate} from '../lib/twilio-menu-sales.js'
import {businessDate} from '../lib/menu-sales.js'
import {negatedClauses,isExcluded,bareDish,looksLikeAnswer,pickPrice,allOptions,leadingInterjection,confirmCleanup,type Excluded} from '../lib/twilio-menu-clarify.js'
import {lastBotTurn,brainGate,hasFreshHistory,brainPlan,memoryTurn,rememberTurn,learnAfter,botBrainEnabled,trackChange,readRestorable} from '../lib/owner-brain-route.js'
import {composeReply,REFERS,mixedMessage,ONE_PRONOUN} from '../lib/owner-brain-plan.js'
import {stripLeadBeforeRemoval,clearChanges,holdFromMessage,holdAnswer,holdQuestion,undoRecordFor,isUndoRequest,applyUndo,undoText,undoWindowMs,type Hold,type UndoRecord} from '../lib/twilio-menu-hold.js'
import {startsWithCreate,parseCreate,createCompound} from '../lib/twilio-menu-create.js'
import {removeVerbRe} from '../lib/twilio-menu-nlu.js'
import {unreadWords,nameIsExplicit} from '../lib/twilio-menu-reading.js'
import {phoneticCandidates} from '../lib/twilio-menu-phonetic.js'
import {relativeDelta,relNormText,g9Prices} from '../lib/twilio-menu-ai.js'
import {isStructAction,parseStructure,DELETE_VERB,plainName,sameSection,courseRank} from '../lib/twilio-menu-structure.js'
import {sqlBrainStore} from '../lib/owner-brain-memory.js'
import {readBotBrain,readBotSettings,engineKey,botEngineOf,type BotEngine} from '../lib/owner-brain-switch.js'
import {phoneticHits,looseSoundAlike,spelledAlike} from '../lib/twilio-menu-phonetic.js'
import {HAIKU_MODEL} from '../lib/owner-brain-anthropic.js'
import {linkIntent,botQuestion,pdfIntent} from '../lib/twilio-menu-nlu.js'
import {signMenuPdfToken,menuPdfUrl,menuPdfSecret,chatPdfAvailable} from '../lib/whatsapp-menu-pdf.js'
import {readWorkspace} from '../lib/menu-workspace-store.js'
import {linkMarkers,noHide} from '../lib/twilio-menu-ai.js'
import {ownerAccount,ownerEmailSchema,dashboardUrl,publicMenuUrl,markPasswordDelivered} from '../lib/whatsapp-owner-account.js'
import {webEmailEnabled} from '../lib/web-email-enabled.js'
import {uniformDelta,uniformReply,pruneWroteDraft} from '../lib/owner-brain-r.js'
import {fixTruncatedNumbers,undoRequested,explicitUndoRequested,ignoredInQuestion,sameQuestion,sameDishName,type Twin,EXPLICIT_SECTION,negatedName,pendOf,decideTurn,cleanDraft,numbersIn,changeFacts,pendingFacts,candidateFacts,holdFacts,reasonText,NOTHING,noopFacts,wholeGroup,wholeGroupText,draftOfUnappliedChange,draftAsksOkOnDate,fixedDishFact,HIDE_WHOLE_MENU_Q,isAffirmative,type Outcome,type BatchWhy,type BrainAsk} from '../lib/owner-brain-r.js'
import {verifyApplied} from '../lib/owner-brain-plan.js'
import {yesToAsk,visibleOnly,allChosen,newCommandOverAsk,nextAskSource,askOrigin,ASK_MAX_ROUNDS,namedMenus,dishCourse,suitableSection,groupCommand as seraGroup,groupPercent,priceSheet,uniformTarget,uniformTargetReply,UNDO_HINT,parseStructRename,renameAskText,clearCommand,specificQuestion,sectionGroupWord,pureDrop,fullyNamed,onlyPrice,singlePrice,answerSectionName,parseSession,sessionName,sectionReplace,dishInSection,sessionStart,sessionRest,sessionExit,sessionDone,keptSections,newCommandInSession,sessionMissing,sessionOpening,sessionAsk,SESSION_MAX_ROUNDS,type SessState} from '../lib/owner-brain-sera.js'
import {publicNames,unknownSectionPhrase,namedSections,sectionListText} from '../lib/owner-brain-sections.js'
import {enqueueTurn,waitTurn,releaseTurn,turnsBusy} from '../lib/whatsapp-turn-queue.js'
import {menusIn,menusAll,contextMenu,ruleTurn,ruleReply,dailyReplaceParse,deleteMenuQuestion,insertForQuestion,shorthand,type RuleWait,type RuleReport,type RuleAsk} from '../lib/owner-brain-svuota.js'
import {loadLexicon,saveSplitRules} from '../lib/dish-lexicon.js'
import type {Lexicon,SplitRule} from '../lib/dish-split.js'
/** 24/10: un piatto di un Menu a prezzo fisso non ha prezzo suo: il testo lo dice con le opzioni e un esempio. */
const fixedDishPriceText=(r:{name:string,menu:string},menus:{name:string,pricing:string,formulas:{name:string,price:number}[]}[])=>{const m=menus.find(x=>x.name===r.menu),eur=(n:number)=>n.toFixed(2).replace('.',',')+' €',lab=/^men[uù]\b/i.test(r.menu.trim())?'*'+r.menu.trim()+'*':'Menu *'+r.menu.trim()+'*',f=m?.formulas??[]
 const meal=/pranz|giorno|mezzogiorno/i.test(r.menu)?' del pranzo':/cen|sera/i.test(r.menu)?' della cena':''
 return '*'+r.name.replace(/\*/g,'')+'* è nel '+lab+' a prezzo fisso: il piatto non ha un prezzo suo, si paga l\u2019opzione'+(f.length?' ('+f.map(x=>'*'+x.name+'* '+eur(Number(x.price))).join(' · ')+')':'')+'. Per cambiarla scrivi per esempio «il '+(f[0]?.name??'completo').toLowerCase()+meal+' a 13». Non ho cambiato nulla.'}
const mLabelOf=(n:string)=>/^men[uù]\b/i.test(n.trim())?'*'+n.trim()+'*':'Menu *'+n.trim()+'*'
const menusmartWebhook='https://mtdguvbpdmekgzaemqoy.supabase.co/functions/v1/whatsapp-webhook'
const digest=(s:string)=>createHash('sha256').update(s).digest('hex')
async function permitted(tx:Pick<DB,'execute'>,actor:string,tenant:string){const rows=await tx.execute(sql`SELECT u.id,u.restaurant_id,u.role,r.active FROM users u JOIN restaurants r ON r.id=${tenant} WHERE u.id=${actor} AND u.active=true`);const u=rows[0];if(!u||!u.active)return false;if(isAgencyUser(actor))return true;if(u.restaurant_id===tenant&&u.role==='owner')return true;const membership=await tx.execute(sql`SELECT role FROM web_location_memberships WHERE user_id=${actor} AND restaurant_id=${tenant}`);return membership[0]?.role==='owner'}
const sent='\u0001'
type Ctx={phone:string,tenant:string,actor:string,pending?:boolean};type Tx=Pick<DB,'execute'>;type Photo={mediaUrl:string,mediaType:string,url?:string};type ChoiceAction={kind:'price',price:number}|{kind:'available'|'hidden'|'featured',value:boolean}|{kind:'description',text:string}|{kind:'tag',tag:string,value:boolean}|SalesTemplate;type Choice={kind:'choose',action:ChoiceAction,options:string[]};type ChoicePrice={kind:'choose_price',id:string,prices:[number,number],labels:[string,string]};type Turn=string|{llm:true,brain?:true,photo?:Photo,text?:string,fullmenu?:FullMenuJob,exclude?:Excluded[],note?:string}|{upload:Extract<MenuAction,{kind:'image'}>[]}
/** 21/10 (richiesta Manuel): numeri WhatsApp del titolare per locale. */
export const OWNER_PHONES_MAX=4 // 22/10 (Manuel): da 2 a 3 numeri per locale; 23/10 (Manuel): 4
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
async function welcomeFor(tx:Tx,tenant:string){const restaurant=await tx.execute(sql`SELECT name FROM restaurants WHERE id=${tenant}`),current=await readBotWorkspace(tenant,tx),catalog=current?catalogOf(workspaceSchema.parse(current.draft)):{refs:[],sections:[]};return welcomeText(String(restaurant[0]?.name),catalog.refs,catalog.sections)}
// 19/10 (decisione Manuel): link della dashboard con le credenziali del titolare e link del menu digitale pubblico.
// La password in chiaro va solo nei messaggi «riservati», mandati via REST e mai salvati (né in tako_whatsapp_messages né in memoria).
type MediaJob={job:'audio'|'image',key:string}
// deliver = utente a cui appartiene la password del primo messaggio riservato: segnata consegnata solo a invio riuscito (19/10 sera).
type Secret={kind:'secret',say:string,secret:string[],ctx:Ctx,deliver?:string}|{kind:'activated',say:string,ctx:Ctx,media?:MediaJob}
type FollowUps={messages:string[],deliver?:string}
const followUpDelayMs=()=>{const v=Number(process.env.TAKO_WHATSAPP_FOLLOWUP_DELAY_MS);return Number.isFinite(v)&&v>=0?v:2000}
const menuLinkText=(tenant:string)=>fill(copy.menuLink,{link:publicMenuUrl(tenant)})
// 19/10 sera: con le email spente (capabilities.email false) il recupero password passa dall'agenzia.
const dashboardLinkText=(link:string,utente:string)=>fill(webEmailEnabled()?copy.dashboardLink:copy.dashboardLinkAgency,{link,utente})
/** «dashboard»: link + utente; se l'account non c'è ancora lo crea e manda anche la password (messaggio riservato). */
async function dashboardTurn(tx:Tx,ctx:Ctx):Promise<{say:string,secret?:string,deliver?:string}>{const account=await ownerAccount(tx,ctx,true),link=dashboardUrl()
 if(!account||'blocked' in account)return{say:fill(copy.dashboardNoAccount,{link})}
 if(account.password)return{say:'',secret:fill(copy.ownerDashboard,{link,utente:account.username,password:account.password}),deliver:account.id}
 return{say:dashboardLinkText(link,account.username)}}
/** Dopo il benvenuto: 1) dashboard con credenziali (o solo utente se l'account c'era già), 2) menu digitale pubblico. */
async function ownerFollowUps(tx:Tx,ctx:Ctx):Promise<FollowUps>{const d=await dashboardTurn(tx,ctx);return{messages:[d.secret??d.say,fill(copy.ownerMenu,{link:publicMenuUrl(ctx.tenant)})],...(d.secret&&d.deliver?{deliver:d.deliver}:{})}}
/** Voci «dashboard»/«menulink» del catalogo scelte dal modello o dalle regole: il link vero del locale (mai creazione account qui). */
async function resolveLinks(tx:Tx,ctx:Ctx,text:string):Promise<string>{if(!text||!text.includes('\u0003'))return text
 if(text.includes(linkMarkers.menulink))text=text.split(linkMarkers.menulink).join(menuLinkText(ctx.tenant))
 if(text.includes(linkMarkers.dashboard)){const account=await ownerAccount(tx,ctx,false),link=dashboardUrl();text=text.split(linkMarkers.dashboard).join(!account||'blocked' in account?fill(copy.dashboardNoAccount,{link}):dashboardLinkText(link,account.username))}
 return text}
/** Richieste di link (con o senza cervello). null = il messaggio va al bot normale. Niente password in chat (19/10). */
async function linkTurn(tx:Tx,ctx:Ctx,body:string):Promise<{say:string,secret?:string,deliver?:string}|null>{
 const intent=linkIntent(body);if(!intent)return null
 // 19/10 sera: se la frase nomina un piatto del catalogo del locale non è una richiesta di link.
 const current=await readBotWorkspace(ctx.tenant,tx),names=current?catalogOf(workspaceSchema.parse(current.draft)).refs.map(r=>r.name):[]
 if(names.length&&!linkIntent(body,names))return null
 return intent==='menu'?{say:menuLinkText(ctx.tenant)}:dashboardTurn(tx,ctx)}
/** 28/10 (decisione Manuel «PDF A4»): «mandami il menu giorno» / «il pdf da stampare» → PDF del Menu dal menu PUBBLICATO, allegato al
 * messaggio. Si guarda il pubblicato perché è quello che vedono i clienti e che il bot modifica. null = il messaggio va avanti.
 * Revisione 28/10: il PDF parte in un messaggio a sé dopo il testo (se Twilio non riesce a scaricarlo, il testo arriva comunque) e
 * solo se il locale lo può servire (la route darebbe 404 a locale spento, in prova o rimosso). */
async function pdfTurn(tx:Tx,ctx:Ctx,body:string):Promise<string|null>{
 // 28/10 sera (chat di Luisa): «Mandami menù giorno» non passava: in JS «ù» non è una lettera per \b. Si filtra sul testo senza accenti.
 const nb0=normalizeMenuText(body);if(!/\b(?:menu|pdf|stamp\w*|anteprim\w*|foto)\b/.test(nb0)&&nb0.split(' ').filter(Boolean).length>5)return null
 const row=await readWorkspace(ctx.tenant,tx),pub=row?.published as Workspace|null|undefined
 const full=(pub?.menus??[]).filter(m=>m.sections.some(s=>s.items.length)),menus=full.map(m=>({id:m.id,name:m.name,active:(m as {active?:boolean}).active!==false}))
 // 28/10 sera: stessa risoluzione dei Menu delle modifiche («menù sera» → Cena) e, per «anteprima» senza nome, il Menu della conversazione.
 const alias=(t:string)=>menusIn(t,full as any[]).map((m:any)=>String(m.id))
 let current:string|null=null,hist:{role:string,text:string,at:number}[]=[]
 const nb=normalizeMenuText(body),short=nb.split(' ').filter(Boolean).length<=5
 if(/\banteprim/.test(nb)||short){try{hist=await sqlBrainStore(tx).readHistory(ctx.tenant,ctx.phone,Date.now())}catch{/* senza cronologia */}}
 if(/\banteprim/.test(nb))current=(contextMenu(hist,full as any[],4) as any)?.id??null
 const shown=menus.filter(m=>m.active).length?menus.filter(m=>m.active):menus
 // 28/10 sera (audit: «mandami il menu» → «Quale menu?» → «cena» rispondeva «Cosa cambio?»): la risposta alla domanda del PDF (nome,
 // numero, «tutti») manda il PDF. Vale solo subito dopo quella domanda (ultimo messaggio del bot, entro 10 minuti) e per risposte brevi.
 const lastBot=[...hist].filter(h=>h.role==='bot').sort((a,b)=>b.at-a.at)[0]
 let intent:ReturnType<typeof pdfIntent>=null
 if(short&&lastBot&&Date.now()-lastBot.at<=10*60*1000&&lastBot.text.includes('Quale menu ti mando in PDF?')){
  const n=nb.match(/^(?:il |la |numero |n )?(\d)$/)?.[1]??({primo:'1',secondo:'2',terzo:'3',quarto:'4',uno:'1',due:'2',tre:'3',quattro:'4'} as Record<string,string>)[nb.replace(/^(?:il |la )/,'')]
  if(n&&shown[Number(n)-1])intent={menuIds:[shown[Number(n)-1]!.id]}
  else if(/^(?:tutti|tutti e (?:due|tre|quattro)|entrambi|tutte)$/.test(nb))intent={menuIds:shown.map(m=>m.id)}
  else{const ids=new Set([...alias(body),...menus.filter(m=>(' '+nb+' ').includes(' '+normalizeMenuText(m.name).replace(/^menu /,'')+' ')).map(m=>m.id)])
   // solo parole di Menu: «cena finito il branzino», «elimina primi menù sera» non sono una risposta alla domanda del PDF
   const keys=new Set(menus.flatMap(m=>normalizeMenuText(m.name).split(' ')))
   const rest=nb.split(' ').filter(w=>w&&!keys.has(w)&&!/^(?:menu|il|la|lo|quello|quella|del|della|di|da|per|sera|stasera|cena|pranzo|mezzogiorno|giorno|oggi|e|ed|grazie|ok|si|allora|mandami|quello|carta|alla)$/.test(w))
   if(ids.size&&!rest.length)intent={menuIds:[...ids]}}}
 if(!intent){if(!/\b(?:menu|pdf|stamp\w*|anteprim\w*|foto)\b/.test(nb))return null;intent=pdfIntent(body,menus,pub?catalogOf(pub).refs.map(r=>r.name):[],{alias,current})}
 // 28/10 sera (verifica: «elimina il menu cena» → «mandami il pdf» → «sì» eliminava il Menu): dopo un turno PDF una conferma di
 // eliminazione ancora aperta decade (il «sì» seguente non deve mai riferirsi a lei)
 if(intent){try{const pend=(await tx.execute(sql`SELECT command FROM tako_whatsapp_proposals WHERE phone=${ctx.phone} AND actor_id=${ctx.actor} AND restaurant_id=${ctx.tenant} AND expires_at>now()`))[0]?.command as any
  if(pend&&pend.kind==='batch'&&pend.why==='delete')await tx.execute(sql`DELETE FROM tako_whatsapp_proposals WHERE phone=${ctx.phone}`)}catch{/* nessuna attesa */}}
 if(!intent)return null
 if('ask' in intent){const list=shown.map(m=>m.name);return fill(copy.pdfWhich,{menu:list.map((n,k)=>(k+1)+'. '+safe(n)).join('\n'),esempio:safe(list[0]!)})}
 if(!await chatPdfAvailable(ctx.tenant,tx))return copy.pdfFailed
 const chosen=intent.menuIds.map(id=>menus.find(m=>m.id===id)!).filter(Boolean),label=chosen.map(m=>m.name).join(' + ')
 let url:string;try{url=menuPdfUrl(signMenuPdfToken({tenant:ctx.tenant,menuIds:chosen.map(m=>m.id)},menuPdfSecret()),label)}catch(error){await reportFailure({kind:'webhook_error',tenant:ctx.tenant,phone:ctx.phone,detail:'pdf link: '+(error instanceof Error?error.message:'Error')});return copy.pdfFailed}
 return fill(copy.pdfSent,{menu:chosen.map(m=>'*'+safe(m.name)+'*').join(' e ')})+nextMessage+withMedia('',url)}
// 19/10 sera: un invio fallito non ferma i messaggi successivi (il link del menu parte comunque); la password del primo messaggio
// si segna consegnata solo se Twilio l'ha accettata, altrimenti al prossimo «dashboard» il bot la rigenera e la rimanda.
async function sendSecrets(ctx:Ctx,out:FollowUps,afterReply:boolean){const accountSid=process.env.TWILIO_ACCOUNT_SID||'',token=process.env.TWILIO_AUTH_TOKEN||'',from=process.env.TWILIO_WHATSAPP_NUMBER||''
 for(const[i,m]of out.messages.entries()){if(!m)continue;if(i>0||afterReply)await new Promise(r=>setTimeout(r,followUpDelayMs()))
  let ok=true;try{await sendWhatsApp(accountSid,token,from,ctx.phone,m)}catch{await new Promise(r=>setTimeout(r,1500));try{await sendWhatsApp(accountSid,token,from,ctx.phone,m)}catch(error){ok=false;await reportFailure({kind:'send_failed',tenant:ctx.tenant,phone:ctx.phone,detail:error instanceof Error?error.message:'Error'})}}
  if(ok&&i===0&&out.deliver)await markPasswordDelivered(db,ctx,out.deliver).catch(error=>reportFailure({kind:'webhook_error',tenant:ctx.tenant,phone:ctx.phone,detail:'password delivered: '+(error instanceof Error?error.message:'Error')}))}}
/** Messaggi dopo l'attivazione: account e link calcolati in una transazione propria (un guasto qui non toglie il benvenuto). */
async function activationFollowUps(ctx:Ctx):Promise<FollowUps>{try{return await db.transaction(async tx=>{await lock(tx,ctx.phone);return ownerFollowUps(tx,ctx)})}
 catch(error){await reportFailure({kind:'webhook_error',tenant:ctx.tenant,phone:ctx.phone,detail:'owner account: '+(error instanceof Error?error.message:'Error')});return{messages:[fill(copy.dashboardNoAccount,{link:dashboardUrl()}),fill(copy.ownerMenu,{link:publicMenuUrl(ctx.tenant)})]}}}
// Guasto simulato per la verifica dal vivo: SOLO questo numero finto (+39 000…, non assegnabile) collegato al locale QA, con questa frase esatta.
const testFaultPhone='whatsapp:+390000000099',qaTenant='26050ecd-2e55-4057-a4c5-bff2b449cd47';class TestFault extends Error{}
const catalogOf=(w:Workspace)=>({refs:w.menus.flatMap(m=>m.sections.flatMap(s=>s.items.map(i=>({id:i.id,name:i.name,price:i.price,available:i.available,hidden:i.hidden,menu:m.name,section:s.name,sectionId:s.id,hasImage:!!i.imageUrl,featured:i.featured,tags:i.tags} as MenuRef)))),sections:w.menus.flatMap(m=>{const pub=publicNames(m,w.design?.manualOrder===true);return m.sections.map(s=>({id:s.id,name:s.name,menu:m.name,...(pub.get(s.id)?{pub:pub.get(s.id)}:{})} as SectionRef))})})
const shown=(target:string)=>target.replace(/^(il|lo|la|i|gli|le|l|un|una|uno)\s+/i,'').slice(0,60)
const bold=(names:string[])=>names.map(n=>'*'+safe(n)+'*').join(', ')
function storedActions(command:any,refs:MenuRef[],sections:SectionRef[]):MenuAction[]|null{
 if(command?.kind==='fullmenu')return null
 if(command?.kind==='batch'&&Array.isArray(command.actions)){const fresh=new Set(command.actions.filter((a:any)=>a.kind==='create_section').map((a:any)=>a.newSectionId)),okSec=(id:string)=>sections.some(s=>s.id===id)||fresh.has(id)
  return command.actions.every((a:any)=>a.kind==='special'||a.kind==='create_section'||a.kind==='create_menu'||a.kind==='delete_menu'||a.kind==='set_menu_active'||a.kind==='rename_menu'||((a.kind==='set_formula'||a.kind==='delete_formula'||a.kind==='set_menu_pricing')&&typeof a.menuId==='string')||((a.kind==='delete_section'||a.kind==='set_section_active')&&sections.some(s=>s.id===a.sectionId))||(a.kind==='rename_section'?sections.some(s=>s.id===a.sectionId):a.kind==='create'?okSec(a.sectionId):a.kind==='move'?okSec(a.sectionId)&&refs.some(r=>r.id===a.id):refs.some(r=>r.id===a.id)))?noHide(command.actions):null}
 const legacy=command as MenuCommand|null;if(!legacy||typeof (legacy as any).name!=='string')return null;const matches=legacy?refs.filter(r=>normalizeMenuText(r.name)===normalizeMenuText(legacy.name)):[];if(!legacy||matches.length!==1)return null;return noHide([legacy.kind==='price'?{kind:'price',id:matches[0]!.id,price:legacy.price}:{kind:legacy.kind,id:matches[0]!.id,value:legacy.value}] as MenuAction[])
}
type TurnOpts={brainOff?:boolean,planned?:{revision:number,plan:MenuPlan,proposalRevision?:string},plannedFull?:{revision:number,job:FullMenuJob,extraction:FullMenuExtraction},voice?:boolean,isExpired?:()=>boolean,beginWrite?:()=>boolean,uploads?:Map<string,string>,exclude?:Excluded[]}
type TurnState={text?:string,exclude:Excluded[],note?:string,brain?:boolean,postDraft?:CreateDraft,postBatch?:any,alsoVerb?:'featured'|'hidden',seen?:string[],batchClosed?:boolean}
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
 // Fase R (17/10 notte, decisione di Manuel «un solo cervello»): col cervello acceso il percorso a regole qui sotto NON interpreta
 // più nessun messaggio: tutto va al modello (brainTurnR). Restano fuori solo i flussi separati (foto in attesa, menu intero,
 // preset) e i comandi della memoria («dimentica X»). Col cervello spento (clienti) questo blocco non fa nulla: v112 invariato.
 if(!opts.planned&&!opts.plannedFull&&!opts.brainOff&&!opts.uploads){const sr=await tx.execute(sql`SELECT settings FROM restaurants WHERE id=${ctx.tenant}`);if(botBrainEnabled(sr?.[0]?.settings)){const r=await brainEntry(tx,ctx,text,opts,sr[0]!.settings);if(r!==null){st.brain=true;return r}}}
 // Fase B (17/10): «sì», «sì eliminalo», «cancella pure» confermano una richiesta di eliminazione in attesa.
 if(!opts.planned&&!opts.plannedFull&&/^\s*(?:(?:si|sì|ok|okay|conferm\w*|certo|esatto|vai|procedi|va bene)[\s,!.]*)*(?:(?:elimina\w*|cancella\w*|crea\w*|toglilo|toglila|pure|procedi|vai|sì|si)[\s,!.]*)*$/i.test(text)&&/\S/.test(text)){const pr=(await tx.execute(sql`SELECT command,revision FROM tako_whatsapp_proposals WHERE phone=${ctx.phone} AND actor_id=${ctx.actor} AND restaurant_id=${ctx.tenant} AND expires_at>now()`))?.[0]?.command as any;if(pr?.kind==='batch'&&Array.isArray(pr.actions)&&pr.actions.some((a:any)=>a.kind==='delete'||a.kind==='create_section'))text='conferma'}
 // A7.3: «aggiungimi i paccheri a 13, ok?» non è una domanda: la coda «, ok?» / «va bene?» dopo un comando si toglie.
 // A7.11 (M2): «buongiorno! la carbonara a 13», «grazie, la carbonara a 13»: il saluto in testa non è il messaggio.
 if(!opts.planned&&!opts.plannedFull){const g=text.match(/^\s*(?:buongiorno|buonasera|buon pomeriggio|ciao|salve|ehi|hey|grazie(?: mille)?|ok grazie)\s*[!,.]*\s+(.{6,})$/i);if(g)text=g[1]!}
 // A7.13 (Groq giù): senza cervello una correzione chiara si legge da sola. «no, la marinara a 6,50» → «la marinara a 6,50»;
 // «no, 13 la gricia, la carbonara 12,50» → «la gricia 13, la carbonara 12,50»; «anzi no, a 19, e mettila in evidenza» → prezzo
 // sull'ultimo piatto + evidenza. Il prefisso si toglie solo se il resto è un comando completo.
 if(opts.brainOff&&!opts.planned&&!opts.plannedFull){const m=text.match(/^\s*(?:(?:no|anzi|scusa|aspetta|ops)[\s,!.;:]+)+(.+)$/i);if(m){let rest=m[1]!.trim().split(/\s*,\s*(?![0-9])/).map(x=>x.replace(/^(\d{1,3}(?:[.,]\d{1,2})?)\s*(?:euro\s+)?((?:il|la|lo|i|gli|le)\s+.+|l['’]\s*.+)$/i,'$2 a $1').replace(/^((?:il|la|lo|i|gli|le)\s+[^\d]*?[a-zà-ù])\s+(\d{1,3}(?:[.,]\d{1,2})?)(?:\s*euro)?$/i,'$1 a $2')).join(', ')
  const both=rest.match(/^(?:a\s+)?(\d{1,3}(?:[.,]\d{1,2})?)(?:\s*euro)?\s*,?\s+e\s+(mettil[ao]\s+in\s+evidenza|nascondil[ao])\s*[.!]?$/i)
  if(both){text='no a '+both[1]!;st.alsoVerb=/evidenza/i.test(both[2]!)?'featured':'hidden'}
  else if((parseIntent(rest)&&!looksLikeQuestion(rest))||/\d/.test(rest)&&rest.split(',').length>1)text=rest}}
 if(!opts.planned&&!opts.plannedFull&&text.trim().split(/\s+/).length>=4)text=text.replace(/[,\s]+(?:ok|okay|va bene|d['’ ]?accordo|grazie|perfetto|si|sì)\s*[?!.]*\s*$/i,'')
 // «nei primi aggiungimi i paccheri a 13», «in carta vini aggiungi il prosecco»: la categoria in testa va dopo il comando.
 if(!opts.planned&&!opts.plannedFull){const m=text.match(/^\s*((?:nei|negli|nelle|nella|nel|tra|fra|in|sotto)\s+(?:i |gli |le |la |il |l['’])?[^,]{2,30}?)\s*,?\s+((?:aggiung|inserisc)\w*\b.+)$/i);if(m&&startsWithCreate(m[2]!))text=m[2]!.replace(/[.!?]+\s*$/,'')+' '+m[1]!}
 if(!opts.planned&&!opts.plannedFull){{const dec=spokenDecimals(text);if(dec!==text){text=dec;st.text=text}};const polite=politeCommand(text);if(polite)text=polite;text=stripLeadBeforeRemoval(text)}
 // 17/10 (vocale di Manuel): risposta alla domanda di una richiesta multipla in sospeso (`hold`): completa TUTTA la richiesta.
 let holdPick:MenuAction[]|null=null,tail=''
 if(!opts.planned&&!opts.plannedFull){const hr=(await tx.execute(sql`SELECT command,revision FROM tako_whatsapp_proposals WHERE phone=${ctx.phone} AND actor_id=${ctx.actor} AND restaurant_id=${ctx.tenant} AND expires_at>now()`))?.[0],hold=(hr?.command as any)?.kind==='hold'?hr!.command as Hold:null
  if(hold){const row0=await readBotWorkspace(ctx.tenant,tx);if(!row0||!row0.published||row0.revision!==row0.published_revision||Number(hr!.revision)!==row0.revision){await tx.execute(sql`DELETE FROM tako_whatsapp_proposals WHERE phone=${ctx.phone}`);return copy.menuChanged}
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
 // A8.0: testo non letto → cervello (se acceso e disponibile) o domanda breve; mai una scrittura.
 const notRead=async(un:string[]):Promise<Turn>=>{if(!opts.brainOff){if(botBrainEnabled((await restaurantSettings())[0]?.settings))st.brain=true;return{llm:true}};return fill(copy.unreadAsk,{testo:safe(un.slice(0,4).join(' '))})}
 const revertLast=/^(no |scusa |aspetta |anzi )*(aspetta )?(lascia stare|lascia perdere|annulla l ultima( modifica)?|torna come prima|rimetti come prima)$/.test(normalized)
 // 17/10: «annulla / torna indietro / rimetti com'era» senza riepilogo in attesa = annulla l'ultima pubblicazione da WhatsApp (10 minuti).
 let undoRec:UndoRecord|null=null
 // A7.10 (M5): «anzi no», «no aspetta», «il prezzo di prima era giusto», «lascia com'era» da soli = annulla l'ultima modifica.
 if(!holdPick&&!planned&&!opts.plannedFull&&/^(?:(?:no|anzi|aspetta|scusa|ops|ah)[\s,!.]*)+$|^(?:anzi\s+no|no|anzi)[\s,]+lascia(?:la|lo|li|le)?(?:\s+(?:stare|cosi|com era|perdere))?$|^(?:no[\s,]+)?(?:aspetta[\s,]+)?(?:il prezzo di prima (?:era|andava) (?:giusto|bene)|era giusto (?:prima|com era)|lascia(?:lo|la)? com era|va bene com era|com era (?:prima )?andava bene)\s*[.!]?$/.test(normalized)&&!/^(?:no|ok|si)$/.test(normalized)){const u=await readUndo(tx,phone);if(u&&Date.now()-Number(u.at)<=undoWindowMs&&!(await tx.execute(sql`SELECT 1 FROM tako_whatsapp_proposals WHERE phone=${phone} AND expires_at>now()`)).length)text='annulla'}
 if(!holdPick&&!planned&&!opts.plannedFull&&isUndoRequest(text)){const waiting=await tx.execute(sql`SELECT 1 FROM tako_whatsapp_proposals WHERE phone=${phone} AND expires_at>now()`)
  if(!waiting.length){undoRec=await readUndo(tx,phone);if(undoRec&&Date.now()-Number(undoRec.at)>undoWindowMs){await writeUndo(tx,phone,null);return copy.undoExpired}}}
 if(reply==='cancel'&&!holdPick&&!undoRec){const waiting=await tx.execute(sql`SELECT 1 FROM tako_whatsapp_proposals WHERE phone=${phone} AND expires_at>now()`);if(!waiting.length&&!revertLast)return copy.nothingToCancel;if(waiting.length){await tx.execute(sql`DELETE FROM tako_whatsapp_proposals WHERE phone=${phone}`);return copy.cancelled}}if(!holdPick&&helpWords.includes(normalized))return copy.help;
 const row=await readBotWorkspace(tenant,tx);if(!row||!row.published)return copy.notPublished;if(row.revision!==row.published_revision)return copy.dashboardPending;const workspace=workspaceSchema.parse(row.draft),{refs,sections}=catalogOf(workspace);
 // A7.13 (anzino-030): «no, al contrario» dopo due prezzi cambiati insieme = i due prezzi scambiati (anche con Groq giù).
 let swapPick:MenuAction[]|null=null
 if(!holdPick&&!planned&&!opts.plannedFull&&!undoRec&&/^(?:(?:no|anzi|scusa|ops)\s+)*(?:e\s+)?(?:al contrario|il contrario|viceversa|sono invertiti|invertiti|invertili|scambiali|al rovescio|li ho invertiti|ho invertito|e il contrario)$/.test(normalized)){const u=await readUndo(tx,phone)
  if(u&&!u.full&&Date.now()-Number(u.at)<=undoWindowMs&&u.items.length===2&&u.items.every(i=>i.before&&i.after&&Number(i.before.price)!==Number(i.after.price))){const [a,b]=u.items.map(i=>refs.find(r=>r.id===i.id));if(a&&b&&a.price!==b.price)swapPick=[{kind:'price',id:a.id,price:b.price},{kind:'price',id:b.id,price:a.price}]}}
 if(undoRec){const res=applyUndo(workspace,undoRec);if(!res.ok)return fill(copy.undoConflict,{piatti:res.changed.slice(0,4).map(n=>'*'+safe(n)+'*').join(', ')})
  const next=workspaceSchema.parse(workspace);if(opts.isExpired?.()||(opts.beginWrite&&!opts.beginWrite()))throw new Error('WhatsApp turn expired');const saved=await applyBotChange(tenant,actor,['WhatsApp: annullamento','WhatsApp: annullamento pubblicato'],{expectedPublishedRevision:row.revision,next},tx as unknown as DB);if(opts.isExpired?.())throw new Error('WhatsApp turn expired');await writeUndo(tx,phone,null);await writeLast(tx,phone,null);return undoText(res)}
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
 // A7.5 (G6/M12): con una bozza di aggiunta in sospeso «lascia stare», «lascia perdere», «niente», «non fa niente», «annulla
 // (tutto)», «no» chiudono la bozza: niente piatto nuovo, e il messaggio dopo è un comando nuovo.
 if(!holdPick&&draft&&/^(?:(?:no|niente|ok|va bene|allora|anzi)[\s,!.]*)*(?:lascia(?:lo|la)?\s+(?:stare|perdere)|lascia\s+perdere|niente|non fa niente|non importa|annulla(?: tutto)?|no|non (?:lo|la) aggiungere|non aggiungere(?: niente| nulla)?|fa niente|lascia)\s*[.!]?$/.test(normalized)){await tx.execute(sql`DELETE FROM tako_whatsapp_proposals WHERE phone=${phone}`);return fill(copy.draftDropped,{piatto:draft.name?'*'+safe(draft.name)+'*':'il piatto'})}
 if(!holdPick&&reply==='confirm'&&draft&&Number(proposal!.revision)===row.revision&&!(draft.sectionName&&!draft.sectionId))return createQuestion(draft,sections);
 if(!holdPick&&reply==='confirm'&&!(draft&&draft.sectionName&&!draft.sectionId)){if(!proposal)return copy.nothingToConfirm;if(pending)return copy.photoNameFirst;if(choice)return copy.chooseFirst;if(choicePrice&&choicePriceDish)return fill(copy.choosePriceAgain,{piatto:itemLabel(choicePriceDish,refs),primo:choicePrice.labels[0],secondo:choicePrice.labels[1]});// Decisione di Manuel (16/10): il riepilogo oltre 3 modifiche si conferma con «OK», «conferma», «confermo», «va bene», «sì conferma»,
  // anche a voce. Vale solo un messaggio fatto SOLO di parole di conferma (replyIntent): «va bene così», «ok la carbonara 14» non confermano.
  if((proposal.command as any)?.requiresTypedOk&&!/^(?:(?:ok|okay|si|conferma|confermo|va|bene|procedi|pubblica)\s*)+$/.test(normalized))return copy.typedOk;const actions=Number(proposal.revision)===row.revision?storedActions(proposal.command,refs,sections):null;if(!actions){await tx.execute(sql`DELETE FROM tako_whatsapp_proposals WHERE phone=${phone}`);return copy.menuChanged}
  const photos=actions.filter((a):a is Extract<MenuAction,{kind:'image'}>=>a.kind==='image'),ready=new Map<string,string>([...photos.flatMap(a=>a.url&&storedUpload(tenant,a.url)?[[a.id,a.url] as [string,string]]:[]),...(uploads??[])]);if(photos.some(a=>!ready.has(a.id)))return{upload:photos.filter(a=>!ready.has(a.id))}
  const beforeW=structuredClone(workspace),restaurant=await restaurantSettings(),names=applyActions(workspace,actions,{uploads:ready,timezone:String((restaurant[0]?.settings as any)?.timezone??'Europe/Rome')}),next=workspaceSchema.parse(workspace)
  const inh=inheritPhotos(beforeW,next);if(opts.isExpired?.()||(opts.beginWrite&&!opts.beginWrite()))throw new Error('WhatsApp turn expired');const saved=await applyBotChange(tenant,actor,['WhatsApp: bozza confermata','WhatsApp: pubblicazione confermata'],{expectedPublishedRevision:row.revision,next},tx as unknown as DB);if(opts.isExpired?.())throw new Error('WhatsApp turn expired');await tx.execute(sql`DELETE FROM tako_whatsapp_proposals WHERE phone=${phone}`);await writeUndo(tx,phone,undoRecordFor(beforeW,next));if(st.brain)await trackChange(tx,phone,undoRecordFor(beforeW,next));void names;return appliedMenuText(actions,refs,sections)+(inh.length?'\n\n'+inheritedNote(inh):'')}
 // Cervello (17/10, perimetro N; settings.botBrain, spento di default): il modello capisce per primo con il contesto (cronologia,
 // memoria, scelta in sospeso). Restano deterministici: riepiloghi, foto, bozze, annulla, parte incerta («tojibo»), scelte già chiare.
 // Fase B (17/10): eliminare, rinominare, spostare, creare/rinominare categorie detti in modo esplicito: deterministici.
 let structPick:MenuAction[]|null=null
 // «no, il caviale lascialo stare» subito dopo averlo aggiunto da qui (10 minuti): si toglie il piatto appena creato, senza conferma.
 if(!planned&&!opts.plannedFull&&!holdPick&&!negPick&&!proposal&&/\b(?:lascia\w*\s+(?:stare|perdere)|lascial\w*\s+(?:stare|perdere)|non\s+(?:lo|la|li|le)\s+(?:aggiungere|mettere|volevo)|toglil[oaie]|leval[oaie])\b/.test(normalized)){const rec=await readUndo(tx,phone)
  if(rec&&Date.now()-Number(rec.at)<=undoWindowMs){const fresh=new Set(rec.items.filter(i=>i.before===null).map(i=>i.id)),hit=refs.filter(r=>fresh.has(r.id)&&(' '+normalized+' ').includes(' '+normalizeMenuText(r.name).replace(/[^a-z0-9]+/g,' ').trim()+' '));if(hit.length)structPick=hit.map(r=>({kind:'delete',id:r.id,undoCreate:true}) as MenuAction)}}
 // A7.7: «aumenta la gricia di 1», «togli 2 euro alla tagliata», «la carbonara e la gricia +1»: prezzo attuale ± differenza.
 if(!planned&&!opts.plannedFull&&!holdPick&&!negPick&&!proposal&&!structPick){const rd=relativeDelta(text);if(rd){const rdKeep=normalizeMenuText(rd.text).replace(/[^a-z0-9+\-.]+/g,' ').replace(/\b(?:aument\w*|alz\w*|rincar\w*|abbass\w*|scont\w*|diminu\w*|ribass\w*|togli\w*|lev[ai]\w*|scal[ai]\w*|ridu[cr]\w*|cal[ai]|calal[ao]|calare|meno|piu|di|in|euro|centesimi|cent|\d+(?:[.]\d+)?|un|uno|una|mezzo|al|alla|allo|ai|agli|alle|dal|dalla|dai|dalle)\b|[+\-]/g,' ').replace(/\s+/g,' ').trim(),rest=relNormText(normalizeMenuText(text)).replace(/[^a-z0-9+\-.]+/g,' ').replace(normalizeMenuText(rd.text).replace(/[^a-z0-9+\-.]+/g,' ').trim(),' '+rdKeep+' ').replace(/(?<!\d)\.|\.(?!\d)/g,' '),parts=rest.split(/\s(?:e|ed)\s|,/).map(x=>x.trim()).filter(x=>words(x).length),ids:string[]=[]
  for(const p of parts){const f=findDishes(p,refs),one=f.length===1?f[0]:f.length>1?exactPick(p,f):null;if(one&&!ids.includes(one.id))ids.push(one.id);else if(f.length){ids.length=0;break}}
  // «carbonara 13 e l'amatriciana un euro in meno»: la differenza è rispetto al prezzo detto prima nello stesso messaggio.
  const abs=g9Prices(normalizeMenuText(text).replace(normalizeMenuText(rd.text),' '))
  if(abs.length){const cmp=/in (?:piu|meno)$/.test(normalizeMenuText(rd.text).replace(/[^a-z0-9 ]+/g,' ').trim());const withP=parts.filter(p=>g9Prices(p).length),withD=parts.filter(p=>!g9Prices(p).length)
   if(cmp&&withP.length===1&&withD.length===1&&abs.length>=1){const a=findDishes(withP[0]!,refs),b=findDishes(withD[0]!,refs),P0=g9Prices(withP[0]!)[0]!;if(a.length===1&&b.length===1&&a[0]!.id!==b[0]!.id&&P0+rd.delta>0)structPick=[{kind:'price',id:a[0]!.id,price:P0},{kind:'price',id:b[0]!.id,price:Math.round((P0+rd.delta)*100)/100}]}
   ids.length=0}
  // «metti la carbonara a 13» → «e la gricia a uno in meno»: con «e/anche» in testa e il comparativo, la differenza è rispetto al
  // prezzo appena messo all'altro piatto (12), non al prezzo attuale della gricia.
  if(ids.length===1&&/in (?:piu|meno)$/.test(normalizeMenuText(rd.text).replace(/[^a-z0-9 ]+/g,' ').trim())&&/^(?:e|ed|anche|pure)\s/.test(normalized)){const last=await readLast(tx,phone,row.revision),prev=last&&last.actions.length===1&&last.actions[0]!.kind==='price'?last.actions[0] as {kind:'price',id:string,price:number}:null
   if(prev&&prev.id!==ids[0]&&lastAge(last!)<=600000&&prev.price+rd.delta>0){structPick=[{kind:'price',id:ids[0]!,price:Math.round((prev.price+rd.delta)*100)/100}];ids.length=0}}
  if(ids.length&&ids.every(id=>{const r=refs.find(x=>x.id===id)!;return r.price+rd.delta>0}))structPick=ids.map(id=>{const r=refs.find(x=>x.id===id)!;return{kind:'price',id,price:Math.round((r.price+rd.delta)*100)/100} as MenuAction})}}
 if(!planned&&!opts.plannedFull&&!holdPick&&!negPick&&!proposal&&!structPick){const sp=parseStructure(text,refs,sections)
  if(sp?.kind==='ask')return sp.text
  // A8.0: anche le conferme di struttura (elimina, categoria nuova) solo con la lettura completa del messaggio.
  const unreadStruct=(acts:MenuAction[],extra:string[]=[])=>unreadWords(text,acts,refs,sections,{excludedIds:st.exclude.map(e=>e.id),extraNames:extra})
  if(sp?.kind==='delete'){const acts=sp.ids.map(id=>({kind:'delete',id}) as MenuAction);{const un=unreadStruct(acts);if(un.length)return notRead(un)};await propose(tx,ctx,row.revision,{kind:'batch',actions:acts,requiresTypedOk:true});return proposalText('',acts,refs,sections)}
  if(sp?.kind==='rename')structPick=[{kind:'rename',id:sp.id,name:sp.name}]
  if(sp?.kind==='rename_section')structPick=[{kind:'rename_section',sectionId:sp.sectionId,name:sp.name}]
  if(sp?.kind==='move'){if(sp.sectionId)structPick=sp.ids.map(id=>({kind:'move',id,sectionId:sp.sectionId!}) as MenuAction)
   else{const sid=randomUUID(),acts=[{kind:'create_section',newSectionId:sid,name:sp.sectionName,menuId:''} as MenuAction,...sp.ids.map(id=>({kind:'move',id,sectionId:sid}) as MenuAction)];{const un=unreadStruct(acts);if(un.length)return notRead(un)};await propose(tx,ctx,row.revision,{kind:'batch',actions:acts,requiresTypedOk:true})
    return fill(copy.sectionAsk,{categoria:safe(sp.sectionName),piatti:bold(sp.ids.map(id=>refs.find(r=>r.id===id)!.name)),categorie:sections.slice(0,15).map(x=>'• '+x.name).join('\n')})}}
  if(sp?.kind==='create_section'){const ex=sections.find(x=>sameSection(x.name,sp.name)),sid=ex?.id??randomUUID(),acts:MenuAction[]=ex?[]:[{kind:'create_section',newSectionId:sid,name:sp.name,menuId:''}]
   if(sp.rest){const c=parseCreate('aggiungi '+sp.rest.replace(/^(?:anche|dentro|ci)\s+/,''),[{id:sid,name:sp.name,menu:''}],true)
    if(c?.name&&c.price!==null&&!refs.some(r=>r.sectionId===sid&&plainName(r.name)===plainName(c.name!)))acts.push({kind:'create',sectionId:sid,name:c.name,price:c.price,description:null})
    else if(c?.name&&c.price===null){st.postDraft={kind:'create_draft',name:c.name,price:null,sectionId:sid}}}
   if(!acts.length&&!st.postDraft)return fill(copy.sectionExists,{categoria:safe(ex!.name)})
   if(!acts.length&&st.postDraft){await propose(tx,ctx,row.revision,st.postDraft);const q=createQuestion(st.postDraft,sections);st.postDraft=undefined;return fill(copy.sectionExists,{categoria:safe(ex!.name)})+' '+q}
   structPick=acts}}
   // A8.5 (Y11/M4): dopo uno spostamento, «anche/pure la gricia» = stessa categoria; «anzi negli speciali», «no, nei primi» =
   // gli stessi piatti nell'altra categoria (deve esistere: una categoria nuova la legge il resto del bot).
  let movePick:MenuAction[]|null=null
  if(!planned&&!opts.plannedFull&&!holdPick&&!negPick&&!proposal&&!structPick){const last=await readLast(tx,phone,row.revision)
   if(last&&lastAge(last)<=600000&&last.actions.length&&last.actions.every(a=>a.kind==='move')){const to=(last.actions[0] as any).sectionId as string,ids=last.actions.map(a=>(a as any).id as string)
    const also=normalized.match(/^(?:e\s+)?(?:anche|pure)\s+(.+)$|^(?:e\s+)?(.+?)\s+(?:anche|pure)$/)
    if(also){const part=(also[1]??also[2])!,hit=findDishes(part,refs);const one=hit.length===1?hit:hit.length>1?[exactPick(part,hit)].filter((x):x is MenuRef=>!!x):[];if(one.length===1&&!ids.includes(one[0]!.id)&&one[0]!.sectionId!==to)movePick=[{kind:'move',id:one[0]!.id,sectionId:to}]}
    const re=normalized.match(/^(?:(?:anzi|no|scusa|aspetta)\s+)+(?:(?:mettil[oaie]|spostal[oaie]|portal[oaie])\s+)?(?:nei|negli|nelle|nella|nel|in|tra|fra)\s+(?:i |gli |le |la |il |l )?(.+)$/)
    if(!movePick&&re){const sec=sections.filter(x=>sameSection(x.name,re[1]!));if(sec.length===1&&sec[0]!.id!==to)movePick=ids.map(id=>({kind:'move',id,sectionId:sec[0]!.id}) as MenuAction)}}}
 // 17/10 (A1.1): con una bozza di aggiunta in sospeso, un messaggio che non la completa («no, intendevo…») va al cervello con
 // la bozza nel contesto; le risposte pulite (prezzo, categoria, «sono due piatti», «10 e 20») restano deterministiche.
 const draftStuck=draft&&Number(proposal!.revision)===row.revision?(()=>{const s0=createStep(text,draft,sections,refs,parseIntent);return s0.kind==='none'||s0.kind==='ask'&&JSON.stringify(s0.draft)===JSON.stringify(draft)&&s0.text===createQuestion(draft,sections)})():false
 if(!planned&&!opts.plannedFull&&!opts.brainOff&&!holdPick&&!negPick&&!structPick&&!swapPick&&!movePick&&!pending&&(!draft||draftStuck)&&(proposal?.command as any)?.kind!=='batch'&&(st.brain=botBrainEnabled((await restaurantSettings())[0]?.settings))){
  const mem=await memoryTurn(tx,tenant,text,refs);if(mem!==null)return mem
  const kind=(proposal?.command as any)?.kind??null,options=choice?choice.options.map(id=>refs.find(r=>r.id===id)).filter((r):r is MenuRef=>!!r):null
  if(brainGate({text,proposalKind:kind,choiceOptions:options,undoish:revertLast||revertTarget(text)==='',freshHistory:await hasFreshHistory(tx,tenant,phone)})){
   const h=kind?null:holdFromMessage(text,sections,refs);if(h&&'hold' in h){await propose(tx,ctx,row.revision,h.hold);return h.text}
   if(!h)return{llm:true,brain:true}}}
 let holdPickSingle:MenuAction[]|null=null
 const batch=proposal&&(proposal.command as any)?.kind==='batch'?storedActions(proposal.command,refs,sections):null;
 if(batch&&Number(proposal!.revision)!==row.revision){await tx.execute(sql`DELETE FROM tako_whatsapp_proposals WHERE phone=${phone}`);return copy.menuChanged}
 // Fase B: una domanda mentre una richiesta aspetta il «sì» (es. «boh c'è ancora?» dopo «elimina boh») si risponde e la richiesta resta.
 if(batch&&!planned&&looksLikeQuestion(text)){const ids=bareDish(text,refs).map(r=>r.id).concat(findDishes(text,refs).map(r=>r.id));const uniq=[...new Set(ids)].slice(0,6);if(uniq.length)return readText({type:'read',read:'items',ids:uniq},refs)+'\n\n'+copy.pendingStill}
 // A7.12 (sospeso-004): con un riepilogo in attesa, un comando nuovo chiaro su un piatto solo che il riepilogo non tocca
 // («la tagliata a 19») si applica da solo; il riepilogo resta in attesa del suo OK, mai pubblicato insieme.
 if(batch&&!planned&&!/,|\s(?:e|ed|anche|poi)\s/i.test(' '+text+' ')){const it=parseIntent(text);if(it&&it.kind==='price'){const h0=findDishes(it.target,refs),ex=h0.length>1?exactPick(it.target,h0):null,hits=ex?[ex]:h0;const inBatch=new Set(batch.flatMap(a=>'id' in a?[(a as any).id]:[]));if(hits.length===1&&!inBatch.has(hits[0]!.id)){st.postBatch=proposal!.command;holdPickSingle=[{kind:'price',id:hits[0]!.id,price:it.price}]}}}
 // A8.2 (Y3/M1): una richiesta di eliminazione (o di categoria nuova) in attesa del «sì» si chiude con qualunque correzione o
 // richiesta nuova: mai più un «sì» dopo che conferma la vecchia. «no, solo la parmigiana», «intendevo boh», «quello no, X» →
 // nuova domanda solo per X; «tieni X» → X tolto dalla domanda; «no, nascondilo (e basta)», «mettilo solo finito» → quello sui
 // piatti in attesa; ogni altro messaggio chiude la domanda e vale come richiesta nuova.
 if(batch&&!planned&&!holdPickSingle&&batch.length&&batch.every(a=>a.kind==='delete'||a.kind==='create_section'||a.kind==='move')&&!/^(?:si|sì|ok|okay|no|annulla|conferma|confermo)$/.test(normalized)){
  const pendIds=batch.flatMap(a=>a.kind==='delete'||a.kind==='move'?[(a as any).id as string]:[]),dels=batch.every(a=>a.kind==='delete')
  const lead=normalized.replace(/^(?:(?:no|scusa|aspetta|anzi|ho sbagliato|errore)\s+)+/,'')
  const only=lead.match(/^(?:quell[oaie] no\s+|(?:il|la|lo|l|i|gli|le)?\s*\S+(?: \S+)? no\s+)?(?:solo|soltanto|intendevo|volevo dire|era)?\s*(.+)$/),keep=normalized.match(/^(?:tieni|tienimi|lascia|lasciami|non (?:eliminare|cancellare|toccare))\s+(.+)$/)
  const pron=lead.match(/^(?:solo\s+|soltanto\s+)?(?:(nascondil[oaie]|nascost[oaie])|(?:(?:mettil[oaie]|segnal[oaie])\s+(?:solo\s+)?(?:come\s+)?)?(finit[oaie]|esaurit[oaie]))(?:\s+e\s+basta|\s+solo|\s+soltanto)?$/)
  const drop=async()=>{await tx.execute(sql`DELETE FROM tako_whatsapp_proposals WHERE phone=${phone}`)}
  if(pron&&pendIds.length){await drop();st.batchClosed=true;holdPickSingle=pendIds.map(id=>(pron[1]?{kind:'hidden',id,value:true}:{kind:'available',id,value:false}) as MenuAction)}
  else if(keep&&dels){const out=findDishes(keep[1]!,refs).map(r=>r.id),left=batch.filter(a=>!out.includes((a as any).id));if(out.length&&left.length<batch.length){if(!left.length){await drop();return fill(copy.negatedOnly,{piatti:keep[1]!})}
   await propose(tx,ctx,row.revision,{kind:'batch',actions:left,requiresTypedOk:true});return proposalText('',left,refs,sections)}}
  else{const target=only&&lead!==normalized||/^(?:solo|soltanto|intendevo|volevo dire|quell[oaie] no)\b/.test(normalized)?only![1]!:null,hits=target?findDishes(target.replace(/^(?:il|la|lo|l|i|gli|le)\s+/,''),refs).filter(r=>!pendIds.includes(r.id)||/\b(?:solo|soltanto)\b/.test(normalized)):[]
   if(dels&&hits.length&&hits.length<=6&&!/\d|\b(?:nascond\w*|finit\w*|esaurit\w*|prezzo|evidenza|rinomin\w*|spost\w*)\b/.test(target!)){const acts=hits.map(r=>({kind:'delete',id:r.id}) as MenuAction);await drop();await propose(tx,ctx,row.revision,{kind:'batch',actions:acts,requiresTypedOk:true});return proposalText('',acts,refs,sections)}
   await drop();return menuTurnCore(tx,ctx,text,opts,st)}}
 if(batch&&!planned&&!holdPickSingle)return{llm:true};
 // «prezzo Pasta e fagioli a 9»: la «e» del nome del piatto non rende composta la frase (era mandata all'IA, senza risposta in 45 s).
 // Aggiunta di un piatto: verbo iniziale o risposta alla domanda in attesa (bozza create_draft), sempre senza IA.
 let created:MenuAction[]|null=holdPick??negPick??structPick??holdPickSingle??swapPick??movePick
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
   if(last){const next=followUp(text,last,refs,lastAge(last),businessDate(String(((await restaurantSettings())[0]?.settings as any)?.timezone??'Europe/Rome')));if(next&&'reply' in next)return next.reply;if(next){created=next;reverted=revert!==undefined;const v=st.alsoVerb,f=next.find(a=>'id' in a);if(v&&f&&'id' in f)created=[...next,{kind:v,id:f.id,value:true} as MenuAction]}}}}
 // 17/10 (vocale di Manuel): richiesta multipla con una parte incerta («… e tojibo» = «togli boh»?) → le parti chiare in sospeso + una domanda.
 if(!created&&!planned&&!pending&&!choice&&!proposal){const h=holdFromMessage(text,sections,refs);if(h){if('hold' in h){await propose(tx,ctx,row.revision,h.hold);return h.text}created=h.actions;if((h as any).seen)st.seen=(h as any).seen;if(h.note)tail=[tail,h.note].filter(Boolean).join('\n\n')}}
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
 // A7.13 (Groq giù): una richiesta composta fatta solo di parti chiare («la gricia 13, la carbonara 12,50») si applica senza IA.
 if(opts.brainOff&&!planned&&!pending&&!choice&&!created&&!bulk&&(isCompoundMessage(text,refs)||/,\s*(?![0-9])/.test(text))){const more=clearChanges(text,refs);if(more?.length)created=more}
 if(!planned&&!pending&&!choice&&!created&&!bulk&&isCompoundMessage(text,refs))return{llm:true};
 let actions:MenuAction[],planAfter:Extract<MenuPlan,{type:'change'}>['after']=undefined;if(planned){if(planned.revision!==row.revision||planned.proposalRevision!==undefined&&planned.proposalRevision!==JSON.stringify(proposal?.command??null))return copy.menuChanged;const plan=planned.plan
  // QA 17/10, caso 3: chiarimento con un'azione già capita → proposta «choose»: la risposta «X» la applica (10 minuti).
  if(plan.type==='clarify'&&plan.actions?.length===1&&!proposal){const a=plan.actions[0]!,template=choiceTemplate(a),options=[...new Set([...('id' in a?[a.id]:[]),...plan.ids])].filter(id=>refs.some(r=>r.id===id)&&!st.exclude.some(e=>e.id===id)).slice(0,8)
   if(template&&options.length>1){await propose(tx,ctx,row.revision,{kind:'choose',action:template,options});return fill(copy.choose,{opzioni:options.map((id,i)=>`${i+1}. *${itemLabel(refs.find(r=>r.id===id)!,refs)}*`).join('\n')})}}
  // A7.12 (M9, «la pasta a 10» con Pasta al sugo e Pasta al pesto): il cervello chiede senza dire cosa → la scelta numerata del
  // percorso deterministico (mai «Non ho capito» quando i piatti possibili sono chiari).
  if(plan.type==='clarify'&&(plan.ids?.length??0)<=1&&!plan.actions?.length&&!proposal){const it=parseIntent(text);if(it&&'target' in it&&it.kind!=='ask'){const f=findDishes(it.target,refs).filter(r=>!st.exclude.some(e=>e.id===r.id));if(f.length>1&&f.length<=8&&!exactPick(it.target,f)){const t0:ChoiceAction=it.kind==='price'?{kind:'price',price:it.price}:it.kind==='description'?{kind:'description',text:it.text}:it.kind==='tag'?{kind:'tag',tag:it.tag,value:true}:{kind:it.kind,value:(it as any).value};await propose(tx,ctx,row.revision,{kind:'choose',action:t0,options:f.map(r=>r.id)});return fill(copy.choose,{opzioni:f.map((r,i)=>`${i+1}. *${itemLabel(r,refs)}*`).join('\n')})}}}
  // 17/10 (A4.3): piatto nuovo con un pezzo mancante capito dall'IA → bozza come nel percorso deterministico: la risposta
  // («12», «nei primi») la completa, e la domanda cita solo ciò che il titolare ha detto (prima: «Rimandami la richiesta completa»).
  if(plan.type==='missing'&&plan.name&&!proposal){const c=parseCreate(text,sections,startsWithCreate(text)),one=c&&c.price!==null&&!createCompound(text)?c.price:null,d:CreateDraft={kind:'create_draft',name:plan.name.charAt(0).toLocaleUpperCase('it')+plan.name.slice(1),price:one,sectionId:sections.length===1?sections[0]!.id:c?.sectionId??null}
   await propose(tx,ctx,row.revision,d);return createQuestion(d,sections)}
  if(plan.type!=='change')return planText(plan,refs,sections);if(!storedActions({kind:'batch',actions:plan.actions},refs,sections))return copy.notUnderstood;actions=batch?mergeMenuActions(batch,plan.actions,plan.remove):plan.actions;planAfter=plan.after}
 else{let picked:MenuAction[]|null=created;if(!picked&&choice){const options=choice.options.map(id=>refs.find(r=>r.id===id)).filter((r):r is MenuRef=>!!r)
   // Una risposta che è già un comando completo («carbonara 10») vale come comando nuovo: mai il valore vecchio in sospeso.
   const t1=normalizeMenuText(text).replace(/[^a-z0-9]+/g,' ').trim(),fresh=parseMenuCommand(text)||(()=>{const i=parseIntent(text);return !!i&&i.kind!=='ask'&&i.kind!=='read'&&i.kind!=='capability'})()||/\d/.test(t1)&&/[a-z]{3}/.test(t1)&&!/^(?:il |la |l )?(?:numero )?\d{1,2}$/.test(t1)
   // A7.9 (ordinali-004): «il primo rimettilo» mentre la domanda era per «in evidenza» non è la scelta per quell'azione:
   // un verbo di un'altra azione rende la risposta un comando nuovo (mai l'azione in sospeso sul piatto scelto).
   {const v=/\b(rimett\w*|mostr\w*)\b/.test(t1)?'hidden:false':/\bnascond\w*\b/.test(t1)?'hidden:true':/\b(finit\w*|esaurit\w*)\b/.test(t1)?'available:false':/\b(tornat\w*|disponibil\w*)\b/.test(t1)?'available:true':/\bevidenza\b/.test(t1)?'featured':null,a0=choice.action as any
    if(v&&!(v===a0.kind||v===a0.kind+':'+a0.value)){await tx.execute(sql`DELETE FROM tako_whatsapp_proposals WHERE phone=${phone}`);return{llm:true}}}
   if(!fresh&&allOptions(text,options.length))picked=options.map(r=>({...choice.action,id:r.id}) as MenuAction)
   else{const target=fresh?null:resolveChoice(text,options);if(target)picked=[{...choice.action,id:target.id} as MenuAction]
   // Risposta che non è tra le opzioni (caso 3): niente scelta silenziosa, si chiede di ripetere la richiesta.
   else if(!fresh){const answer=looksLikeAnswer(text,refs);if(answer){await tx.execute(sql`DELETE FROM tako_whatsapp_proposals WHERE phone=${phone}`);return fill(copy.chooseInvalid,{nome:safe(answer)})}
    const t0=normalizeMenuText(text).replace(/[^a-z0-9]+/g,' ').trim();if(t0&&!/\d/.test(t0)&&t0.split(' ').length<=5&&!findDishes(text,refs).length&&!parseIntent(text)&&!wantsCreateText(text))return copy.chooseAgain}}}
  const command=parseMenuCommand(text)
  // 22/10 (decisione foto per nome): la foto va su TUTTI i piatti con quel nome normalizzato, in tutti i Menu, senza chiedere.
  if(!picked&&!command&&pending){const matches=dishMatches(text,refs);if(!matches.length)return{llm:true,photo:{mediaUrl:pending.mediaUrl,mediaType:pending.mediaType,...(pending.url?{url:pending.url}:{})}};picked=matches.map(m=>({kind:'image',id:m.id,mediaUrl:pending.mediaUrl,mediaType:pending.mediaType,...(pending.url?{url:pending.url}:{})}) as MenuAction)}
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
   if(found.length===1&&!command&&intent.kind!=='ask'){const riv=diminutiveRivals(intent.target,found[0]!,refs);if(riv.length){const options=[found[0]!,...riv].slice(0,8),t0:ChoiceAction=intent.kind==='price'?{kind:'price',price:intent.price}:intent.kind==='description'?{kind:'description',text:intent.text}:intent.kind==='tag'?{kind:'tag',tag:intent.tag,value:true}:{kind:intent.kind,value:intent.value};await propose(tx,ctx,row.revision,{kind:'choose',action:t0,options:options.map(r=>r.id)});return fill(copy.choose,{opzioni:options.map((r,i)=>`${i+1}. *${itemLabel(r,refs)}*`).join('\n')})}}
   // A7.11 (M3): «hai messo la carbonara a 13?», «perché la bomba è a 4?»: si risponde sui piatti nominati, mai «Non trovo «hai messo…»».
   if(intent.kind==='ask'){if(mixedMessage(text))return{llm:true};if(found.length)return readText({type:'read',read:'items',ids:found.slice(0,6).map(r=>r.id)},refs);const inside=findDishes(text,refs);if(inside.length&&inside.length<=6)return readText({type:'read',read:'items',ids:inside.map(r=>r.id)},refs)
    // A7.11/A7.13 (Groq giù): «ho messo la carbonara a 13 o no?» → la scheda dei piatti nominati, mai «Non trovo «ho messo…»».
    {const nt=' '+normalizeMenuText(text).replace(/[^a-z0-9]+/g,' ')+' ',named=refs.filter(r=>nt.includes(' '+normalizeMenuText(r.name).replace(/[^a-z0-9]+/g,' ').trim()+' ')),pre=named.length?named:preselect(text,refs,3);if(pre.length&&pre.length<=6)return readText({type:'read',read:'items',ids:pre.map(r=>r.id)},refs)}
    return st.brain?{llm:true}:fill(copy.notFoundNamed,{nome:shown(intent.target)})}
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
 if(st.exclude.length){actions=actions.filter(a=>(a as any).fromRestore||!isExcluded(a as any,st.exclude));if(!actions.length){if(batch)return copy.pendingEmpty;return fill(copy.negatedOnly,{piatti:[...new Set(st.exclude.map(e=>refs.find(r=>r.id===e.id)?.name).filter((n):n is string=>!!n))].slice(0,4).map(safe).join(', ')})}}
 // A8.0 «lettura completa»: una scrittura dal percorso deterministico solo se ogni parola del messaggio è spiegata dalle azioni
 // capite; altrimenti cervello (validatore) o, con Groq spento, una domanda che cita il testo non letto.
 // Esenti: annulla/ripristini (grammatica chiusa) e le azioni del percorso vendite (promo, etichette, scarsità).
 if(!planned&&!holdPick&&!swapPick&&!negPick&&!reverted&&!preUndo.length&&!actions.some(a=>(a as any).fromRestore)&&!actions.every(a=>a.kind==='promo'||a.kind==='scarcity'||a.kind==='tag')){const un=unreadWords(text,actions,refs,sections,{excludedIds:[...st.exclude.map(e=>e.id),...(st.seen??[])],known:draft?[draft.name??'',...(draft.names??[]),draft.sectionName??'']:[],lenientNumbers:!!choice||!!choicePrice});if(un.length)return notRead(un)}
 {const problem=salesActionProblem(actions,workspace);if(problem)return problem}
 actions=effectiveMenuActions(actions,workspace);
 // A4.4: la risposta alla domanda dello stesso messaggio segue la modifica (letta sul menu dopo il salvataggio).
 const afterText=(w:Workspace)=>planAfter?'\n\n'+planText(planAfter,catalogOf(w).refs,sections):''
 if(!actions.length){if(batch||holdPick)await tx.execute(sql`DELETE FROM tako_whatsapp_proposals WHERE phone=${phone}`);return batch?copy.pendingEmpty:copy.noChanges+afterText(workspace)}
 // G6: prezzo implausibile (oltre 500 € o almeno 8 volte quello attuale: lo zero in più; round 2: 3× bloccava prezzi veri) → conferma scritta, mai online diretto.
 const implausible=actions.some(a=>(a.kind==='price'||a.kind==='create'||a.kind==='special')&&(a.price>500||(a.kind==='price'&&(()=>{const r=refs.find(x=>x.id===a.id);return !!r&&r.price>0&&a.price>=8*r.price})())))
 // Fase B: eliminare chiede SEMPRE conferma («Elimino X dal menu? Rispondi sì»), anche da sola.
 const needsApproval=(!!batch&&!st.postBatch&&!st.batchClosed)||actions.length>3||implausible||actions.some(a=>a.kind==='delete'&&!a.undoCreate&&!a.soft);
 // 22/10 notte: «nascondere» un piatto non esiste più (noHide in effectiveMenuActions): niente nota «l'ho nascosto».
 const withTail=(s:string)=>tail?s+'\n\n'+tail:s
 if(needsApproval){await propose(tx,ctx,row.revision,{kind:'batch',actions,requiresTypedOk:true});const restaurant=await tx.execute(sql`SELECT name FROM restaurants WHERE id=${tenant}`);return withTail(proposalText(String(restaurant[0]?.name),actions,refs,sections)+afterText(workspace))}
 const photos=actions.filter((a):a is Extract<MenuAction,{kind:'image'}>=>a.kind==='image'),ready=new Map<string,string>([...photos.flatMap(a=>a.url&&storedUpload(tenant,a.url)?[[a.id,a.url] as [string,string]]:[]),...(uploads??[])]);
 if(photos.some(a=>!ready.has(a.id))){await propose(tx,ctx,row.revision,{kind:'batch',actions,autoApply:true});return{upload:photos.filter(a=>!ready.has(a.id))}}
 const waItems=new Map(workspace.menus.flatMap(m=>m.sections.flatMap(sec=>sec.items.map(i=>[i.id,structuredClone(i)] as const)))),memo=actions.slice(preUndoLen),undo=undoFor(memo,id=>waItems.get(id) as any);
 const beforeW=structuredClone(workspace),restaurant=await restaurantSettings();applyActions(workspace,actions,{uploads:ready,timezone:String((restaurant[0]?.settings as any)?.timezone??'Europe/Rome')});const next=workspaceSchema.parse(workspace);
 const inh=inheritPhotos(beforeW,next);if(opts.isExpired?.()||(opts.beginWrite&&!opts.beginWrite()))throw new Error('WhatsApp turn expired');const saved=await applyBotChange(tenant,actor,['WhatsApp: aggiornamento automatico','WhatsApp: pubblicazione automatica'],{expectedPublishedRevision:row.revision,next},tx as unknown as DB);if(opts.isExpired?.())throw new Error('WhatsApp turn expired');await tx.execute(sql`DELETE FROM tako_whatsapp_proposals WHERE phone=${phone}`);if(st.postDraft)await propose(tx,ctx,saved.revision+1,st.postDraft);else if(st.postBatch)await propose(tx,ctx,saved.revision+1,st.postBatch);await rememberRenames(tx,tenant,actions,refs,(await restaurantSettings())[0]?.settings);await writeLast(tx,phone,!reverted&&memo.length&&memo.every(a=>a.kind==='move')?{kind:'last',actions:memo,undo:memo.map(a=>({kind:'move',id:(a as any).id,sectionId:refs.find(r=>r.id===(a as any).id)?.sectionId??(a as any).sectionId}) as MenuAction),revision:saved.revision+1,at:Date.now()}:!reverted&&undo&&(memo.length===1||memo.every(a=>a.kind==='promo'||a.kind==='scarcity'||a.kind==='tag'))?{kind:'last',actions:memo,undo,revision:saved.revision+1,at:Date.now()}:null);await writeUndo(tx,phone,undoRecordFor(beforeW,next));if(st.brain)await trackChange(tx,phone,undoRecordFor(beforeW,next));return withTail(appliedMenuText(actions,refs,sections)+(inh.length?'\n\n'+inheritedNote(inh):'')+afterText(next)+(st.postDraft?'\n\n'+createQuestion(st.postDraft,catalogOf(next).sections):st.postBatch?'\n\n'+copy.batchStill:''))
}
/** Fase B (B3.2): dopo «rinomina boh in Bollito» il vecchio nome resta un alias del piatto nella memoria del ristorante
 * (solo col cervello acceso), così «boh» continua a funzionare. Mai verso un nome che è di un altro piatto. */
async function rememberRenames(tx:Tx,tenant:string,actions:MenuAction[],refs:MenuRef[],settings:unknown){
 const ren=actions.filter((a):a is Extract<MenuAction,{kind:'rename'}>=>a.kind==='rename');if(!ren.length||!botBrainEnabled(settings))return
 try{const store=sqlBrainStore(tx),now=Date.now();for(const a of ren){const old=refs.find(r=>r.id===a.id);if(!old)continue;const phrase=plainName(old.name);if(!phrase||refs.some(r=>r.id!==a.id&&plainName(r.name)===phrase))continue
  await store.saveMemory({id:randomUUID(),restaurantId:tenant,phrase,kind:'alias',itemId:a.id,meaning:a.name,state:'active',confirmations:2,uses:0,lastUsedAt:now,origin:'owner',createdAt:now,updatedAt:now})
  await store.log(tenant,{memoryId:null,phrase,op:'create',itemId:a.id,detail:{motivo:'rinomina'}})}}catch{/* la memoria non deve mai rompere la risposta */}}
/** Fase R: ingresso del turno col cervello acceso. null = flusso separato in corso (foto, menu intero): percorso di prima. */
async function brainEntry(tx:Tx,ctx:Ctx,text:string,opts:TurnOpts,settings:any):Promise<Turn|null>{
 const pr=(await tx.execute(sql`SELECT command FROM tako_whatsapp_proposals WHERE phone=${ctx.phone} AND actor_id=${ctx.actor} AND restaurant_id=${ctx.tenant} AND expires_at>now()`))?.[0]?.command as any
 if(pr?.kind==='photo'||pr?.kind==='fullmenu')return null
 const row=await readBotWorkspace(ctx.tenant,tx);if(!row||!row.published)return copy.notPublished;if(row.revision!==row.published_revision)return copy.dashboardPending
 const workspace=workspaceSchema.parse(row.draft),{refs}=catalogOf(workspace)
 const mem=await memoryTurn(tx,ctx.tenant,text,refs);if(mem!==null)return mem
 const presetReply=await presetChatCommand(tx,ctx,text);if(presetReply)return presetReply
 const normalized=normalizeMenuText(text).replace(/[^a-z0-9]+/g,' ').trim()
 // notte 22/10 (cc-foglio-01/02): un listino di prezzi dei piatti GIÀ nel menu non è un menu nuovo da importare: va al cervello (lo legge il server).
 if(botEngineOf(settings)==='haiku'&&priceSheet(text,refs))return{llm:true,brain:true}
 const full=await fullMenuTurn(tx,ctx,text,{revision:row.revision,workspace,refs,reply:null,normalized,voice:opts.voice,timezone:String(settings?.timezone??'Europe/Rome'),isExpired:opts.isExpired});if(full!==null)return full
 return{llm:true,brain:true}}
function uniformBulk(actions:MenuAction[],refs:MenuRef[],message:string,sections:SectionRef[]=[]){if(!/\btutt[ieao]\b/.test(normalizeMenuText(message))&&!sectionGroupWord(plain(message),sections,refs))return false // notte 22/10: anche «alza i dolci di 50 centesimi» (sottomenu intero)
 // Prova dal vivo 21/10 sera («metti tutte le paste a 9 euro»): «tutte» è chiaro, lo stesso prezzo su tutto il gruppo si applica subito.
 // notte 22/10 (cc-vietato-05, «metti tutti i dolci a zero» applicato a 4 piatti): un gruppo con prezzi a 0 o cambi enormi non è mai «subito».
 if(groupPriceRisk(actions,refs)&&groupWording(message,sections,refs))return false
 if(uniformTarget(actions)!==null&&actions.every(a=>refs.some(r=>r.id===(a as any).id&&r.price>0)))return true
 const d=new Set<number>();for(const a of actions){if(a.kind!=='price')return false;const r=refs.find(x=>x.id===a.id);if(!r||!(r.price>0))return false;d.add(Math.round((a.price-r.price)*100))}
 return d.size===1&&!d.has(0)}
/** notte 22/10 — SICUREZZA prezzi. Un prezzo singolo «fuori scala» rispetto a quello attuale (0 su un piatto che ha un prezzo, meno di
 * 50 centesimi, oltre 500 €, 8 volte di più o 8 volte di meno) chiede una conferma col sì; un cambio su PIÙ piatti con un prezzo a 0 o
 * con una variazione oltre il 50% (in su o in giù) chiede il riepilogo con OK. Vincolo del server, indipendente dal modello. */
function oddPrice(a:MenuAction,refs:MenuRef[]):boolean{if(a.kind!=='price'&&a.kind!=='create'&&a.kind!=='special')return false;const p=(a as any).price as number;if(typeof p!=='number')return false
 if(p>500||(p>0&&p<0.5))return true
 if(a.kind!=='price')return false;const r=refs.find(x=>x.id===a.id);if(!r||!(r.price>0))return false
 return p<=0||p>=8*r.price||p*8<=r.price}
function priceAskText(actions:MenuAction[],refs:MenuRef[],sections:SectionRef[]):string{const eur=(n:number)=>n.toFixed(2).replace('.',',')+' €'
 const odd=actions.filter(a=>oddPrice(a,refs)),line=(a:MenuAction)=>{const p=(a as any).price as number,r='id' in a?refs.find(x=>x.id===(a as any).id):undefined,nm=r?r.name:String((a as any).name??'')
  return '*'+safe(nm)+'* a *'+eur(p)+'*'+(r&&r.price>0?' (adesso '+eur(r.price)+')':'')+(p<=0?': con 0 € il prezzo non si vede nel menu':'')}
 const q=odd.length===1?line(odd[0]!)+'? Mi sembra un prezzo strano.':'Questi prezzi mi sembrano strani:\n'+odd.map(x=>'• '+line(x)).join('\n')
 return [q+(odd.length>1?'\n\n':' ')+'Rispondi *sì* per pubblicare oppure scrivimi il prezzo giusto.',actions.length>1?'Non ancora pubblicato:\n'+actions.map((a,i)=>(i+1)+'. '+describeAction(a,refs,withNewSections(sections,actions))).join('\n'):''].filter(Boolean).join('\n\n')}
/** Il messaggio è un comando su un GRUPPO non elencato piatto per piatto («tutti», «i dolci», «del 10%»): lì vale groupPriceRisk.
 * «mettili entrambi a 15» dopo due piatti nominati è un prezzo detto per quei piatti (vale solo il controllo del prezzo singolo). */
function groupWording(message:string,sections:SectionRef[],refs:MenuRef[]):boolean{const p=plain(message);return /\btutt[ieoa]\b/.test(p)||!!groupPercent(message)||!!sectionGroupWord(p,sections,refs)}
/** notte 22/10 (imperfezione «sezione Pizze e pinse» inventata dal modello): frasi della bozza che nominano un Menu/Sottomenu che nel locale
 * non c'è (e che il turno non crea) cadono. `names` = nomi validi (Menu, Sottomenu, quelli creati adesso). */
// 22/10 Victoria: anche «*Menu Pranzo*» inventato (asterischi attorno a «Menu X»).
export function dropInventedGroups(draft:string|null,names:string[],said=''):string|null{if(!draft)return draft;const ok=names.map(n=>plain(n)).filter(Boolean),sp=' '+plain(said)+' '
 const fake=(x:string)=>[...x.matchAll(/\b(?:sottomenu|sezione|categoria|menu|menù)\s+(?:dei |delle |degli |del |della |di )?\*([^*\n]{2,40})\*/gi),...x.matchAll(/\*((?:menu|menù)\s+[^*\n]{2,40})\*/gi)].some(m=>{const k=plain(m[1]!).replace(/^menu\s+/,'');return !!k&&!sp.includes(' '+k+' ')&&!ok.some(o=>{const o2=o.replace(/^menu\s+/,'');return o===k||o2===k||sameSection(o,k)||(k.length>=4&&(o2.startsWith(k)||(' '+o+' ').includes(' '+k+' ')))})})
 const keep=draft.split(/(?<=[.!?])\s+/).filter(x=>!fake(x));return keep.join(' ').trim()||null}
function groupPriceRisk(actions:MenuAction[],refs:MenuRef[]):boolean{const ps=actions.filter(a=>a.kind==='price') as Extract<MenuAction,{kind:'price'}>[];if(ps.length<2)return false
 return ps.some(a=>{const r=refs.find(x=>x.id===a.id);return !!r&&r.price>0&&(a.price<=0||Math.abs(a.price-r.price)/r.price>0.5+1e-9)})}
/** Una proposta ha bisogno del «sì»/«OK» del titolare? (vincoli del server, non interpretazione: elimina, categoria nuova non
 * chiesta esplicitamente, oltre 3 modifiche, prezzo implausibile G6). */
/** `strict` (motore haiku, PIANO bot-haiku T4b): oltre 3 modifiche serve SEMPRE l'OK, anche per l'aumento uniforme di un gruppo
 * (opzione conservativa: il playground 17 «aumenta tutte le pizze di un euro» attende riepilogo + OK); un intero menu o sottomenu
 * nascosto piatto per piatto chiede sempre conferma. */
function approvalFor(actions:MenuAction[],refs:MenuRef[],message:string,answered=false,strict=false,sections:SectionRef[]=[]):BatchWhy|null{
 if(actions.some(a=>a.kind==='delete'&&!a.undoCreate&&!a.soft))return 'delete'
 const structOnly=strict&&actions.length>0&&actions.every(a=>a.kind==='create_menu'||a.kind==='create_section'||a.kind==='delete_menu'||a.kind==='delete_section'||a.kind==='set_menu_active'||a.kind==='set_section_active')
 // Sostituzione giornaliera dei piatti di un sottomenu (menu fisso) e opzioni di prezzo: subito; togliere un'opzione = conferma.
 if(strict&&actions.length>0&&actions.every(a=>(a as any).fromReplace||isStructAction(a))&&actions.some(a=>(a as any).fromReplace||a.kind==='set_formula'||a.kind==='delete_formula'||a.kind==='set_menu_pricing'))return actions.some(a=>a.kind==='delete_formula')?'recap':null
 if(structOnly)return actions.some(a=>(a.kind==='set_menu_active'||a.kind==='set_section_active')&&!a.value&&a.items>0)?'recap':null
 if(!strict&&actions.some(a=>a.kind==='create_section')&&!EXPLICIT_SECTION.test(normalizeMenuText(message).replace(/[^a-z0-9]+/g,' ')))return 'section'
 // Un solo comando su un gruppo («aumenta tutti i piatti della categoria X di un euro»): stessa differenza su ogni piatto → si
 // applica subito col riepilogo numerato dei fatti (decisione 18/10, nota 62). Altrimenti oltre 3 modifiche serve l'OK.
 // Richiesta esplicita di categorie nuove con i loro piatti («aggiungi un'altra categoria, primi, e lì aggiungi…»): è un solo comando di
 // struttura detto per intero, si applica subito (nota 64).
 // R9: la risposta alla domanda «lo aggiorno o ne creo un altro?» (che mostrava le parti in attesa, numerate) conferma la richiesta intera.
 if(strict&&wholeGroup(actions,refs,sections))return 'recap'
 if(strict&&groupPriceRisk(actions,refs)&&groupWording(message,sections,refs))return 'recap'
 if(actions.length>3&&!answered&&!uniformBulk(actions,refs,message,sections)&&!(EXPLICIT_SECTION.test(normalizeMenuText(message).replace(/[^a-z0-9]+/g,' '))&&actions.some(a=>a.kind==='create_section')&&actions.every(a=>a.kind==='create_section'||a.kind==='move'||a.kind==='create')))return 'recap'
 if(actions.some(a=>oddPrice(a,refs)))return 'price'
 return null}
/** Fase R: il turno del cervello. Il modello decide e scrive; il server valida (una auto-correzione), impone i vincoli, scrive
 * e aggiunge i fatti riletti dal DB. Groq giù → copy.brainDown, nessuna modifica, nessuna riserva a regole. */
/** Il messaggio senza le parole del nome del piatto in bozza («lasagna 12» → «12»). */
const CMD_RE_NEW=/\b(?:aggiung\w*|nascond\w*|togli\w*|elimin\w*|rinomin\w*|abbass\w*|alz\w*|aument\w*|diminu\w*)\b/
const draftless=(text:string,name:string)=>{const ws=new Set(plain(name).split(' '));return plain(text).split(' ').filter(w=>!ws.has(w)&&!(w.length>4&&[...ws].some(x=>x.length>4&&x.slice(0,-1)===w.slice(0,-1)))).join(' ')}
async function brainTurnR(ctx:Ctx,text0:string,key:string,ai:GroqOptions,budget:Budget,voice=false,replay=false):Promise<string>{
 // notte 22/10 (cc-conferme-02): 👍 / 👌 / ✅ da soli valgono «ok» (prima «Per "👍" mi manca un dettaglio»); per eliminare serve un sì scritto.
 const thumbs=budget.engine==='haiku'&&/^(?:\u{1F44D}|\u{1F44C}|\u2705|\u{1F197})[\u{1F3FB}-\u{1F3FF}\uFE0F]*$/u.test(text0.trim())
 budget.brain=true;const text=thumbs?'ok':(budget.engine==='haiku'?fixTruncatedNumbers(text0):text0).trim()||'[messaggio vuoto]'
 const row=await readBotWorkspace(ctx.tenant);if(!row)throw new Error('Workspace missing');if(!row.published)return copy.notPublished;if(row.revision!==row.published_revision)return copy.dashboardPending
 const {refs,sections}=catalogOf(workspaceSchema.parse(row.draft))
 if(text.length>30000||refs.length>1500)return copy.brainDown
 const pr=(await db.execute(sql`SELECT command,revision FROM tako_whatsapp_proposals WHERE phone=${ctx.phone} AND actor_id=${ctx.actor} AND restaurant_id=${ctx.tenant} AND expires_at>now()`))[0]
 const cmd=pr&&Number(pr.revision)===row.revision?pr.command as any:null
 let pend=pendOf(cmd)
 if(thumbs&&pend?.kind==='batch'&&pend.why==='delete')return 'Per eliminare mi serve un *sì* scritto: rispondi *sì* per confermare oppure *annulla*.'
 let answered=pend?.kind==='ask'&&!!pend.ask.twins?.length
 const undoRec=await readUndo(db,ctx.phone),undoOK=!!undoRec&&Date.now()-Number(undoRec.at)<=undoWindowMs,dropText=undoRec&&Date.now()-Number(undoRec.at)<=3*60*1000?'Ok, lascio stare.':'Ok, lascio stare: non ho cambiato nulla.' // fase 3: mai «non ho cambiato nulla» subito dopo una scrittura
 const undoNames=undoOK?(undoRec!.full?[...undoRec!.full.names.restored,...undoRec!.full.names.removed]:undoRec!.items.map(i=>String(refs.find(r=>r.id===i.id)?.name??i.after?.name??i.before?.name??'')).filter(Boolean)):[]
 const name=String((await db.execute(sql`SELECT name FROM restaurants WHERE id=${ctx.tenant}`))[0]?.name??'')
 const restorable=await (async()=>{const a=await readRestorable(db,ctx.phone),b=undoRec,items=[...(a?.items??[])];for(const i of b&&Date.now()-Number(b.at)<=30*60*1000?b.items:[])if(!items.some(x=>x.id===i.id))items.push({id:i.id,before:i.before,sectionId:i.sectionId});return items.length?{at:Date.now(),items}:null})()
 const last=await readLast(db,ctx.phone,row.revision),extraRestore=last?last.undo.flatMap(a=>'id' in a?[{id:(a as any).id as string,actions:last.undo.filter(b=>'id' in b&&(b as any).id===(a as any).id)}]:[]):[]
 const freshIds=new Set(undoOK&&!undoRec!.full?undoRec!.items.filter(i=>i.before===null).map(i=>i.id):[])
 // PIANO bot-haiku: con haiku il turno intero (auto-correzioni comprese) sta in 25 s; cervello giù → brainDown + avviso a Manuel.
 const engine=budget.engine,deadline=Date.now()+30_000
 let downReason=''
 const onDown=engine==='haiku'?(reason:string)=>{downReason=reason;inBackground(reportFailure({kind:'job_failed',tenant:ctx.tenant,phone:ctx.phone,detail:'haiku: '+reason+(reason==='timeout'?' (messaggio lungo)':'')}))}:undefined
 const down=()=>engine==='haiku'&&downReason==='timeout'&&text.length>=80?copy.brainSlow:copy.brainDown // notte 22/10: «il messaggio è lungo» solo se lo è
 const base={menus:(workspaceSchema.parse(row.draft).menus as any[]).map((m:any)=>({id:m.id as string,name:m.name as string,sections:(m.sections??[]).length as number,active:m.active!==false,pricing:(m.pricing==='fisso'?'fisso':'carta') as 'carta'|'fisso',formulas:(m.formulas??[]).map((f:any)=>({id:f.id as string,name:f.name as string,price:Number(f.price)})),included:(m.included??null) as string|null,secs:(m.sections??[]).map((x:any)=>({id:x.id as string,name:x.name as string,active:x.active!==false,parent:(x.parentSectionId??null) as string|null,items:(x.items??[]).length as number}))})),voice,tenant:ctx.tenant,phone:ctx.phone,restaurantName:name,text,refs,sections,pendingCommand:cmd,key,ai,engine,deadline,onDown,undo:restorable,extraRestore,freshIds,undoInfo:undoOK?{minutes:Math.max(1,Math.ceil((undoWindowMs-(Date.now()-Number(undoRec!.at)))/60000)),names:undoNames.length?undoNames:['struttura del menu (sottomenu)']}:null}
 const approval=(actions:MenuAction[],refs0:MenuRef[],message:string,ans=false)=>approvalFor(actions,refs0,message,ans,engine==='haiku',sections)
 const fixedSecIds=new Set(base.menus.filter(m=>m.pricing==='fisso').flatMap(m=>m.secs.map((x:{id:string})=>x.id)))
 // 28/10 (giornata Luisa: «porta il tiramisu a 6» → «la cotoletta mettila a 5» → «intendi *Cotoletta*?» / «A quale piatto metto 5 €?»):
 // al posto della domanda generica, se il piatto è detto per nome, c'è un prezzo e il piatto è in un Menu a prezzo fisso → la spiegazione.
 const askFor=(text:string,list:MenuRef[])=>{const nm=(list.length?list:refs.filter(r=>!r.hidden&&fullyNamed(r.name,text))).filter(r=>fullyNamed(r.name,text)||spelledAlike(text,r.name));return nm.length===1&&fixedSecIds.has(nm[0]!.sectionId??'')&&singlePrice(text)!==null&&!/\b(?:finit|esaurit|tornat|nascond|togli|lev[ai]|rimett)\w*/.test(plain(text))?fixedDishPriceText(nm[0]!,base.menus):specificQuestion(text,list)}
 const decide=(run:NonNullable<Awaited<ReturnType<typeof brainPlan>>>)=>decideTurn({decision:run.decision as any,control:run.decision.control??[],raw:run.decision.raw,message:text,pend,undoOK,sections,refs,lastBot:run.lastBot,fixedSecIds})
 // R5.1: anche i prezzi attuali dei piatti nominati nel messaggio («C'è già pasta al ragù a 12 €: lo aggiorno o ne creo un altro?»): sono fatti del menu.
 const namedPrices=(()=>{const t=' '+normalizeMenuText(text).replace(/[^a-z0-9]+/g,' ')+' ';return refs.filter(r=>{const n=normalizeMenuText(r.name).replace(/[^a-z0-9]+/g,' ').trim();return n.length>=3&&t.includes(' '+n+' ')}).map(r=>r.price)})()
 // run Haiku 21/10: anche i prezzi VERI dei piatti che la bozza nomina per intero («C'è già *X* a 12 €»): sono fatti del menu (un prezzo inventato resta bloccato).
 const draftNamed=(run:NonNullable<Awaited<ReturnType<typeof brainPlan>>>)=>{const d=' '+normalizeMenuText(String(run.decision.draft??'')).replace(/[^a-z0-9]+/g,' ')+' ';return refs.filter(r=>{const n=normalizeMenuText(r.name).replace(/[^a-z0-9]+/g,' ').trim();return n.length>=3&&d.includes(' '+n+' ')}).map(r=>r.price)}
 // Menu a prezzo fisso (21/10): i prezzi veri delle opzioni sono fatti del menu (una bozza che li cita non è un prezzo inventato).
 const formulaPrices=base.menus.flatMap(m=>m.pricing==="fisso"?m.formulas.map((f:{price:number})=>f.price):[])
 // notte 22/10 (cc-prezzo-08 «abbacchio 1850»): le letture possibili di un numero senza virgola (1850 → 18,50; 4.000 → 4) valgono per
 // una DOMANDA del modello («Intendi 18,50 €?»), prima scartata come prezzo inventato.
 const readings=[...text.matchAll(/(?<![\d.,])(\d{3,4})(?![\d.,])/g)].map(m=>Number(m[1])/100).concat([...text.matchAll(/(?<![\d.,])(\d{1,3})\.(\d{3})(?![\d.,])/g)].flatMap(m=>[Number(m[1]!),Number(m[1]!+m[2]!)/100]))
 const numbersOK=(run:NonNullable<Awaited<ReturnType<typeof brainPlan>>>,extra:number[]=[])=>[...numbersIn(text),...readings,...numbersIn(run.ownerRecent??''),...namedPrices,...(engine==='haiku'?draftNamed(run):[]),...formulaPrices,...extra]
 // Una domanda (o una risposta senza scrittura) senza testo del modello utilizzabile vale come piano da rifare.
 const needsText=(o:Outcome,run:NonNullable<Awaited<ReturnType<typeof brainPlan>>>)=>(o.kind==='change'&&engine!=='haiku'&&!!approval(o.actions,refs,text,answered)&&!/\?|rispondi|scrivi/i.test(cleanDraft(run.decision.draft,{wrote:false,numbers:numbersOK(run,o.actions.flatMap(a=>'price' in a&&typeof (a as any).price==='number'?[(a as any).price]:[]))})??''))||(o.kind==='ask'||o.kind==='say')&&!cleanDraft(run.decision.draft,{wrote:false,numbers:numbersOK(run,[...o.kind==='ask'?o.ids.map(id=>refs.find(r=>r.id===id)?.price??-1):[]])})
 // ── Prova dal vivo 21/10 sera (QA): rete di sicurezza deterministica sulla domanda in sospeso (owner-brain-sera.ts) ──────────────
 // Con haiku, PRIMA del modello: (1) rinomina di Menu/Sottomenu letta dal server; (2) «sì» / «tutte» / «solo le visibili» a una
 // domanda con azioni pronte = si applicano subito; (3) comando nuovo, o domanda già al 2° giro = la domanda si chiude e il
 // messaggio va da solo; (4) «solo quelle visibili» dopo una scrittura = i piatti nascosti tornano com'erano.
 type Follow={name:string,sectionId:string,sectionName:string,origin:string}
 let pre:{actions:MenuAction[],why:string,follow?:Follow|null}|null=null,preReply:string|null=null,closePend=false,sessNow:SessState|null=null,sessNote='',sessAfter:SessState|null=null,ruleRep:RuleReport|null=null
 // 23/10 (divisione con la «e»): domanda sul pezzo dubbio da fare DOPO la scrittura, regole da imparare, testo della correzione
 let ruleAsk:RuleAsk|null=null,ruleLearn:SplitRule[]=[],ruleFix:string|null=null,lexicon:Lexicon|null=null
 if(engine==='haiku'){
  const askP=pend?.kind==='ask'?pend.ask as BrainAsk&{origin?:string,rounds?:number,session?:SessState}:null
  const rn=parseStructRename(text,base.menus,sections)
  // Sessione di modifica dei piatti di oggi (21/10 sera, flusso del menu giornaliero): lo stato sta nel pending; il server tiene cosa è
  // detto / cosa resta com'è, applica tutto insieme quando ogni sottomenu è coperto; il modello decide le domande su ciò che manca.
  const sess=askP?.session&&typeof askP.session.menuName==='string'?askP.session:null
  const mLab=(n:string)=>/^men[uù]\b/i.test(n.trim())?'*'+safe(n.trim())+'*':'Menu *'+safe(n.trim())+'*'
  const saveSess=async(s2:SessState,q:string)=>db.transaction(async tx=>{await lock(tx,ctx.phone);await propose(tx,ctx,row.revision,{kind:'brain_ask',question:q,ids:[],actions:[],source:askP?askOrigin(askP):text.slice(0,600),origin:askP?askOrigin(askP):text.slice(0,600),rounds:1,session:s2} as any)})
  // 22/10 (v138 dal vivo): passo DETERMINISTICO della sessione. Le liste per sottomenu, le correzioni e le aggiunte le legge il server;
  // i piatti già detti restano (mai rifatti dal modello), il nuovo nei menu fissi nasce a 0 € senza domande, alla carta vuole il prezzo.
  const sessStep=(st:SessState,msg:string):{kind:'apply',actions:MenuAction[]}|{kind:'ask',q:string}|{kind:'info',q:string}|{kind:'out'}|null=>{
   const mSecs=sections.filter(x=>x.menu===st.menuName),ps=parseSession(msg,mSecs,refs.map(r=>r.name)),vocab=refs.map(r=>r.name),fixedM=base.menus.find(m=>m.id===st.menuId)?.pricing==='fisso'
   const missing0=sessionMissing(st,sections),tranne=/\b(?:tranne|eccetto|a parte|salvo)\b/.test(plain(msg))?keptSections(msg,mSecs,missing0):[]
   const yesK=!!askP&&yesToAsk(msg,{question:askP.question,actions:[],draft:null}),priceOnly=onlyPrice(msg)
   // «cotoletta 14»: il prezzo di un piatto nuovo alla carta che la sessione aveva chiesto.
   const unpriced=fixedM?[]:Object.entries(st.done).flatMap(([id,ns])=>sectionReplace(id,ns,refs,false,st.prices??{}).noPrice),sp=singlePrice(msg),named=sp!==null?unpriced.filter(n=>fullyNamed(n,msg)):[]
   if(named.length===1){st.prices={...(st.prices??{}),[named[0]!]:sp!}}
   if(!ps.lists.length&&!ps.removes.length&&!ps.adds.length&&!ps.keep.length&&!ps.done&&!yesK&&!tranne.length&&priceOnly===null&&!named.length)return null
   st.prices={...(st.prices??{})};if(named.length&&!ps.lists.length&&!ps.removes.length&&!ps.adds.length){/* solo il prezzo */}
   const unknown:string[]=[],touched=new Set<string>()
   const inSec=(id:string)=>refs.filter(r=>r.sectionId===id)
   for(const l of ps.lists){if(!l.secId){unknown.push(l.key);continue}const names:string[]=[];for(const n of l.names){const r=sessionName(n,inSec(l.secId),vocab);if(r.price)st.prices[r.name]=r.price;if(!names.includes(r.name))names.push(r.name)}st.done[l.secId]=names;st.kept=st.kept.filter(k=>k!==l.secId);touched.add(l.secId)}
   for(const k of ps.keep){const sc=mSecs.find(x=>sameSection(x.name,k)||plain(x.name)===k);if(!sc){unknown.push(k);continue}if(!st.done[sc.id]&&!st.kept.includes(sc.id))st.kept.push(sc.id)}
   for(const id of tranne)if(!st.kept.includes(id)&&!st.done[id])st.kept.push(id)
   let lastSec:string|null=null
   for(const x of ps.removes){const k=plain(x);let hit=false
    for(const [id,names] of Object.entries(st.done)){const keep=names.filter(n=>{const pn=plain(n);return !(pn===k||pn.includes(k)||(k.length>=5&&dishInSection(x,[{id:'x',name:n,price:0,available:true,hidden:false,menu:'',sectionId:id} as MenuRef])))});if(keep.length!==names.length){st.done[id]=keep;hit=true;touched.add(id);lastSec=id}}
    if(!hit){const sc=mSecs.find(z=>dishInSection(x,inSec(z.id).filter(r=>!r.hidden)));if(sc){const vis=inSec(sc.id).filter(r=>!r.hidden).map(r=>r.name),drop=dishInSection(x,inSec(sc.id).filter(r=>!r.hidden))!;st.done[sc.id]=(st.done[sc.id]??vis).filter(n=>n!==drop.name);st.kept=st.kept.filter(z=>z!==sc.id);touched.add(sc.id);lastSec=sc.id}}}
   for(const a of ps.adds){const byKey=a.key?mSecs.find(z=>sameSection(z.name,a.key!)):undefined,byDish=mSecs.find(z=>dishInSection(a.name,inSec(z.id))),byCourse=mSecs.find(z=>{const c=dishCourse(a.name);return !!c&&sameSection(z.name,c)})
    const sc=byKey??byDish??(lastSec?mSecs.find(z=>z.id===lastSec):undefined)??byCourse??(mSecs.length===1?mSecs[0]:undefined);if(!sc){unknown.push(a.name);continue}
    const r=sessionName(a.name,inSec(sc.id),vocab);if(r.price)st.prices[r.name]=r.price;const base0=st.done[sc.id]??inSec(sc.id).filter(z=>!z.hidden).map(z=>z.name);st.done[sc.id]=[...base0.filter(n=>n!==r.name),r.name];st.kept=st.kept.filter(z=>z!==sc.id);touched.add(sc.id)}
   // Solo un prezzo («12») con un solo piatto nuovo alla carta senza prezzo: è il suo.
   if(priceOnly!==null&&!fixedM){const pend0=Object.entries(st.done).flatMap(([id,ns])=>sectionReplace(id,ns,refs,false,st.prices).noPrice);if(pend0.length===1)st.prices[pend0[0]!]=priceOnly}
   // «togli la pasta al sugo» con un piatto che nel Menu della sessione non c'è: è un comando a sé (la sessione si chiude).
   if(!touched.size&&(ps.removes.length||ps.adds.length)&&!ps.lists.length&&!ps.keep.length&&!ps.done&&!yesK)return{kind:'out'}
   if(ps.done||yesK)for(const x of sessionMissing(st,sections))st.kept.push(x.id)
   const unk=[...new Set(unknown.filter(u=>!mSecs.some(z=>sameSection(z.name,u))))]
   sessNote=unk.length?'Nel '+mLab(st.menuName)+' non c\u2019è '+unk.map(u=>'*'+safe(u.charAt(0).toUpperCase()+u.slice(1))+'*').join(' né ')+': ci sono '+mSecs.map(z=>'*'+safe(z.name)+'*').join(', ')+'.':''
   const ready=st.applied?[...touched]:sessionMissing(st,sections).length?[]:Object.keys(st.done)
   if(!ready.length&&(st.applied||!sessionMissing(st,sections).length))return{kind:'info',q:sessNote||(st.applied?'Ok, i piatti di oggi restano come li hai messi.':'Ok, il '+mLab(st.menuName)+' resta com\u2019era.')}
   if(!ready.length)return{kind:'ask',q:[sessNote,sessionAsk(st,sections)].filter(Boolean).join(' ')}
   const parts=ready.map(id=>sectionReplace(id,st.done[id]!,refs,!!fixedM,st.prices)),noP=parts.flatMap(x=>x.noPrice)
   if(noP.length)return{kind:'ask',q:[sessNote,'Per i piatti nuovi mi serve il prezzo: '+noP.map(n=>'*'+safe(n)+'*').join(', ')+'. Scrivimi per esempio «'+noP[0]!.toLowerCase()+' 12».'].filter(Boolean).join(' ')}
   return{kind:'apply',actions:parts.flatMap(x=>x.actions)}}
  const runStep=async(st:SessState,msg:string)=>{const r=sessStep(st,msg);if(!r)return false
   if(r.kind==='info'){preReply=r.q;closePend=true;return true}
   if(r.kind==='out'){closePend=true;pend=null;answered=false;(base as any).pendingCommand=null;return true}
   if(r.kind==='ask'){let q=r.q;if(askP&&plain(q)===plain(askP.question??''))q='Mi mancano ancora: '+sessionMissing(st,sections).map(x=>'*'+safe(x.name)+'*').join(', ')+'. Scrivimi i piatti oppure «restano uguali».';preReply=q;await saveSess(st,q);closePend=false}
   else{sessAfter={...st,applied:true,rounds:0};if(r.actions.length)pre={actions:r.actions,why:'sessione'};else{preReply=[sessNote,'Ok, i piatti di oggi del '+mLab(st.menuName)+' sono già così.'].filter(Boolean).join(' ');await saveSess(sessAfter,'');closePend=false}}
   return true}
  // Regola d'uso 22/10 (decisione Manuel, Victoria Bar): «svuota/togli tutto il menu X» = nasconde i piatti, tiene sottomenu e prezzi fissi;
  // «nei primi inserisci A, B» = visibili/creati nel sottomenu del Menu di cui si parla, gli altri non si toccano. Letta dal SERVER prima del
  // modello (owner-brain-svuota.ts); con un Menu ambiguo una domanda di una riga. Anche la sostituzione «stasera a cena primi: …» detta
  // con il Menu (bug 16:37 «trovo più sottomenu Primi», 17:48 «pasta e fagioli» persa) è letta dal server.
  let ruleDone=false
  // Risposta alla proposta «Elimino il Menu X intero?»: «sì» scritto → eliminato (annulla 10 minuti); «no»/«annulla» → niente.
  const delM=cmd?.kind==='batch'&&cmd.why==='delete'&&Array.isArray(cmd.actions)&&cmd.actions.length===1&&cmd.actions[0]?.kind==='delete_menu'&&cmd.actions[0]?.withItems?cmd.actions[0] as Extract<MenuAction,{kind:'delete_menu'}>:null
  if(delM&&base.menus.some(m=>m.id===delM.menuId)){const pt=plain(text)
   if(/^(?:s[iì]|si si|sì sì|si confermo|confermo|si elimina|si eliminalo|elimina|eliminalo|si cancellalo|cancellalo|ok si|si ok|si certo|certo)(?:\s+(?:grazie|pure|dai|tutto))?$/.test(pt)){pre={actions:[delM],why:'regola-elimina'};ruleDone=true}
   else if(/^(?:ok|okay|oki|va bene|perfetto|vai|procedi|d accordo|esatto|giusto|fallo|confermo tutto)$/.test(pt)){preReply='Per eliminare il '+mLab(delM.name)+' intero mi serve un *sì* scritto: rispondi *sì* per eliminarlo, oppure *no*.';ruleDone=true}
   else if(/^(?:no|non|annulla|lascia stare|lascia perdere|niente|fermo|aspetta|no grazie|no no|non eliminare|non eliminarlo|no lascia stare|anzi no|anzi|ho sbagliato|scusa)\b/.test(pt)){preReply='Ok, non elimino niente: il '+mLab(delM.name)+' resta com\u2019è.';closePend=true;ruleDone=true}
   // 28/10 sera (audit: «elimina il menu cena» → «sì ma tieni i primi» / «grazie» / «?» → «sì» eliminava tutto): qualunque altra risposta
   // chiude la richiesta di eliminazione; il messaggio si legge come nuovo e un «sì» dopo non elimina più nulla.
   else{closePend=true;pend=null;answered=false;(base as any).pendingCommand=null}}
  // 23/10 (chat Luisa, invariante «ogni domanda sì/no ha una proposta salvata e consumabile»): un «sì» scritto a una proposta in attesa
  // (eliminazione, riepilogo, prezzo strano) la applica deciso dal SERVER, senza passare dal modello. Per eliminare serve un sì vero
  // («sì», «elimina», «conferma»), non un «ok» o un pollice.
  // 28/10 sera (audit): eliminazione in attesa (sottomenu alla carta): solo un «sì» pulito elimina; «no/anzi no» la chiude; ogni altra
  // risposta («sì ma lascia il tartufo», «ok», «non lo so», «grazie») la chiude senza eliminare.
  if(!ruleDone&&!delM&&pend?.kind==='batch'&&pend.why==='delete'){const pt=plain(text)
   // «sì», «si va bene», «sì sì eliminali», «certo, eliminali», «va bene eliminali», «ok eliminali», «sì vai»
   if(/^(?:(?:s[iì]+|certo|ok|okay|va bene|vai|procedi|confermo|d accordo)\s*)*(?:s[iì]+|eliminal[io]|elimina\w*|cancellal[io]|cancella\w*|procedi|vai|confermo)(?:\s+(?:grazie|pure|dai|tutto|tutti|va bene|vai))*$/.test(pt)&&/\b(?:s[iì]+|elimin\w*|cancell\w*|procedi|confermo)\b/.test(pt)){pre={actions:[],why:'conferma'};ruleDone=true}
   else if(/^(?:ok|okay|va bene|perfetto|vai|d accordo|esatto|giusto|certo|fallo|👍)$/.test(pt)||(!pt&&/[👍👌]/u.test(text))){preReply='Per eliminarli mi serve un *sì* scritto: rispondi *sì* per eliminarli, oppure *no*.';ruleDone=true}
   else if(/^(?:no|non|annulla|lascia stare|lascia perdere|niente|anzi no|anzi|no grazie|no no|ho sbagliato|scusa|aspetta)\b/.test(pt)){preReply='Ok, non elimino niente: resta tutto com\u2019è.';closePend=true;ruleDone=true}
   else{closePend=true;pend=null;answered=false;(base as any).pendingCommand=null}}
  if(!ruleDone&&!delM&&pend?.kind==='batch'&&pend.why!=='delete'&&isAffirmative(text)){pre={actions:[],why:'conferma'};ruleDone=true}
  if(!ruleDone&&(!sess||sess.applied)){const ruleWait=((askP as any)?.rule??null) as RuleWait|null
   let hist:{role:string,text:string,at:number}[]=[];try{hist=await sqlBrainStore(db).readHistory(ctx.tenant,ctx.phone,Date.now())}catch{/* senza cronologia: solo il Menu detto */}
   const draftName=askP?.draft?.name&&!askP.draft.sectionId?String(askP.draft.name):null
   // 23/10: lessico del locale (nomi attuali + storico + regole imparate) solo se il messaggio può contenere una «e» da decidere o una
   // correzione; lettura con tetto di tempo (mai bloccante: in errore valgono i nomi attuali).
   if(ruleWait?.kind==='split'||/\b(?:e|ed|sono|separat\w*|divid\w*|unisc\w*|insieme|parte|solo|unico)\b/.test(plain(text)))lexicon=await loadLexicon(db as any,ctx.tenant,refs.map(r=>r.name))
   const rr=ruleTurn({text,menus:base.menus,sections,refs,history:hist,wait:ruleWait,draftName,lexicon})
   if(rr){ruleDone=true;if(askP){closePend=true;pend=null;answered=false;(base as any).pendingCommand=null}
    if('learn' in rr&&rr.learn?.length)ruleLearn=rr.learn
    if(rr.kind==='apply'){pre={actions:rr.actions,why:'regola'};ruleRep=rr.report;ruleAsk=rr.ask??null}
    else if(rr.kind==='fix'){pre={actions:rr.actions,why:'regola'};ruleFix=rr.reply}
    else if(rr.kind==='info'){preReply=rr.text;if(ruleLearn.length)await saveSplitRules(db as any,ctx.tenant,ruleLearn,'correction')}
    // «elimina il menu pranzo» (correzione Manuel 22/10): il Menu intero, SOLO col «sì» scritto (proposta di eliminazione in attesa)
    // 23/10: sottomenu di un Menu alla carta da svuotare: proposta di eliminazione (il «sì» la applica, letto dal server).
    else if(rr.kind==='confirm'){const acts=rr.actions;await db.transaction(async tx=>{await lock(tx,ctx.phone);await propose(tx,ctx,row.revision,{kind:'batch',actions:acts,requiresTypedOk:true,why:'delete'})});preReply=rr.question+(acts.length<=12?'\n\n'+pendingFacts('delete',acts,refs,sections):'');closePend=false}
    else if(rr.kind==='delete_menu'){const q=deleteMenuQuestion(rr),act={kind:'delete_menu',menuId:rr.menu.id,name:rr.menu.name,withItems:true,items:rr.items} as MenuAction;await db.transaction(async tx=>{await lock(tx,ctx.phone);await propose(tx,ctx,row.revision,{kind:'batch',actions:[act],requiresTypedOk:true,why:'delete'})});preReply=q;closePend=false}
    else{const q=rr.question,w=rr.wait;if(ruleLearn.length)await saveSplitRules(db as any,ctx.tenant,ruleLearn,'clarify');await db.transaction(async tx=>{await lock(tx,ctx.phone);await propose(tx,ctx,row.revision,{kind:'brain_ask',question:q,ids:[],actions:[],source:text.slice(0,600),origin:text.slice(0,600),rounds:1,rule:w} as any)});preReply=q;closePend=false}}
   // 28/10 sera (batteria): un «grazie/ok» dopo «elimina X» non fa perdere il sottomenu svuotato (l'attesa resta, scade da sola)
   else if(ruleWait?.kind==='names'&&(ruleWait as any).ctx&&/^(?:grazie(?: mille)?|ok(?:ay)?|perfetto|va bene|bene|ottimo|top|si|sì|👍)[!. ]*$/i.test(text.trim())){/* resta in attesa */}
   else if(ruleWait){closePend=true;pend=null;answered=false;(base as any).pendingCommand=null
    // batteria v183 (GRAVE, come QA v153): «no / scusa / lascia stare» alla domanda della regola chiude SOLO la domanda; senza
    // questo il modello, senza più nulla in sospeso, annullava la modifica di prima.
    if(/^(?:(?:no|ah|allora|aspetta|scusa|ok|ops)\s+)*(?:no|lascia (?:stare|perdere)|lasciamo (?:stare|perdere)|niente|no grazie|scusa|ho sbagliato|non importa|fa niente|nessuno)$/.test(plain(text)))preReply=dropText}
   else if(!askP&&!rn){const dr=dailyReplaceParse(shorthand(text),base.menus,sections,refs,lexicon)
    if(dr){const vocab=refs.map(r=>r.name),acts=dr.lists.flatMap(l=>{const inS=refs.filter(r=>r.sectionId===l.secId);return sectionReplace(l.secId,[...new Set(l.names.map(n=>sessionName(n,inS,vocab).name))],refs,true).actions});if(acts.length){pre={actions:acts,why:'sostituzione'};ruleDone=true}
     else{preReply='Il '+mLab(dr.menu.name)+' è già così: non ho cambiato nulla.';ruleDone=true}}}}
  if(ruleDone){/* regola svuota/inserisci o sostituzione letta dal server */}
  else if(sess){const mSecs=sections.filter(x=>x.menu===sess.menuName),s2:SessState={...sess,done:{...sess.done},kept:[...sess.kept],acts:[...(sess.acts??[])],rounds:(sess.rounds??0)+1}
   if(sess.applied&&(sessionExit(text)||isUndoRequest(text)||/\b(?:grazie|perfetto|ok|va bene|fatto|basta)\b/.test(plain(text))&&!parseSession(text,mSecs).lists.length))closePend=true
   else if(sessionExit(text)){preReply='Ok, lascio il '+mLab(sess.menuName)+' com\u2019era: non ho cambiato nulla.';closePend=true}
   else if(newCommandInSession(text,sess.menuName,base.menus)||rn)closePend=true
   else if(await runStep(s2,text)){/* passo deterministico */}
   else if(sess.applied)closePend=true
   else{for(const id of keptSections(text,mSecs,sessionMissing(s2,sections)))if(!s2.kept.includes(id))s2.kept.push(id)
    const yesKeep=yesToAsk(text,{question:askP!.question,actions:[],draft:null})
    if(sessionDone(text)||yesKeep)for(const x of sessionMissing(s2,sections))s2.kept.push(x.id)
    const restart=sessionStart(text,base.menus)?.name===sess.menuName&&sessionRest(text,sess.menuName)<=1
    const covered=!sessionMissing(s2,sections).length,talk=restart?0:plain(text).split(' ').filter(w=>w&&!/^(?:restan\w*|resta|rimang\w*|uguali|uguale|come|prima|salta\w*|i|gli|le|il|la|e|anche|pure|cosi|ok|si|fatto|finito|basta|tutto|qui|altri|resto|lasciali|lasciale|invariati|non|cambiare|stessi|stesse|va|bene|ieri|sempre|stessa|quelli|quelle|di|del|della|dei|delle|oggi|anche|loro|tranne)$/.test(w)&&!mSecs.some(x=>sameSection(x.name,w))).length
    if(!talk||s2.rounds!>=SESSION_MAX_ROUNDS){if(covered||s2.rounds!>=SESSION_MAX_ROUNDS){if(s2.acts.length)pre={actions:s2.acts,why:'sessione'};else{preReply='Ok, il '+mLab(sess.menuName)+' resta com\u2019era.';closePend=true}}
     else{preReply=sessionAsk(s2,sections);if(plain(preReply)===plain(askP!.question??''))preReply='Mi mancano ancora: '+sessionMissing(s2,sections).map(x=>'*'+safe(x.name)+'*').join(', ')+'. Scrivimi i piatti o «restano uguali».';const q=preReply;await saveSess(s2,q)}}
    else{sessNow=s2;(base as any).pendingCommand={...cmd,session:s2}}}}
  else if(!rn){const sm=sessionStart(text,base.menus);if(sm&&sections.some(x=>x.menu===sm.name)){if(askP){closePend=true;pend=null;answered=false}const s0:SessState={menuId:sm.id,menuName:sm.name,done:{},kept:[],acts:[],rounds:0}
    if(sessionRest(text,sm.name)<=1){preReply=sessionOpening(s0,sections);const q=preReply;await saveSess(s0,q);closePend=false}
    else if(await runStep(s0,text)){/* lista già nel messaggio di avvio */}
    else{sessNow=s0;(base as any).pendingCommand={kind:'brain_ask',question:'',ids:[],actions:[],source:text.slice(0,600),session:s0}}}}
  if(preReply||sessNow||pre){/* sessione: niente altri percorsi deterministici */}
  else if(rn){closePend=!!askP;if('ask' in rn){let q=renameAskText(rn.ask,base.menus,sections,/\b(?:sottomenu|sezione)\b/.test(plain(text)))
    // Mai la stessa domanda due volte di fila: la seconda volta l'esempio da copiare.
    if(askP&&plain(askP.question??'')===plain(q))q='Non lo trovo: scrivimi così, «rinomina il '+(/\b(?:sottomenu|sezione)\b/.test(plain(text))?'sottomenu':'menu')+' <nome di adesso> in <nome nuovo>». Quale vuoi rinominare? '+q.replace(/^[^?]*\?\s*/,'')
    preReply=q;await db.transaction(async tx=>{await lock(tx,ctx.phone);await propose(tx,ctx,row.revision,{kind:'brain_ask',question:q,ids:[],actions:[],source:text.slice(0,600),origin:text.slice(0,600),rounds:1} satisfies BrainAsk)});closePend=false}
   else pre={actions:[rn.kind==='rename_menu'?{kind:'rename_menu',menuId:rn.menuId,name:rn.name,before:rn.before} as MenuAction:{kind:'rename_section',sectionId:rn.sectionId,name:rn.name,before:rn.before} as MenuAction],why:'rinomina'}}
  else if(askP&&!askP.twins?.length&&!sess){let partial:{q:string,patch:Record<string,unknown>}|{create:MenuAction}|null=null
   const stored=storedActions({kind:'batch',actions:askP.actions??[]},refs,sections)??[],ids=(askP.ids??[]).filter(id=>refs.some(r=>r.id===id)),origin=askOrigin(askP)
   const yes=yesToAsk(text,askP),all=allChosen(text),vis=visibleOnly(text)&&ids.length>=2,priceOnly=!!askP.draft?.name&&askP.draft.price==null&&onlyPrice(draftless(text,askP.draft.name))!==null
   // Gruppo di candidati («Intendi tutte e cinque le paste a 9 €?»): «sì»/«tutte»/«solo le visibili» = l'azione su ognuno.
   const expand=():MenuAction[]|null=>{const want=refs.filter(r=>ids.includes(r.id)&&(!vis&&!visibleOnly(origin)||!r.hidden));if(!want.length)return null
    const pr=stored.filter(a=>a.kind==='price') as Extract<MenuAction,{kind:'price'}>[],abs=[...new Set(pr.map(a=>Math.round(a.price*100)))],dl=[...new Set(pr.map(a=>Math.round((a.price-(refs.find(r=>r.id===a.id)?.price??0))*100)))]
    const rd=relativeDelta(origin),said=[...new Set(g9Prices(origin,false))]
    const val=(r:MenuRef)=>pr.length&&abs.length===1?abs[0]!/100:pr.length&&dl.length===1&&pr.length>1?Math.round((r.price+dl[0]!/100)*100)/100:!pr.length&&rd?Math.round((r.price+rd.delta)*100)/100:!pr.length&&said.length===1?said[0]!:null
    const acts=want.flatMap(r=>{const v=val(r);return v!==null&&v>0&&r.price>0?[{kind:'price',id:r.id,price:v} as MenuAction]:[]});return acts.length?acts:null}
   let acts:MenuAction[]|null=null
   // 23/10 (chat Luisa «Intendi i Primi del Menu Giorno da 12 € per eliminarli tutti? 1… 2… 3…» → «Si» → di nuovo «Elimino…? Rispondi sì»):
   // il sì a una domanda che chiede di ELIMINARE i piatti elencati è la conferma: si eliminano (annulla 10 minuti), mai una seconda domanda.
   if(yes&&!stored.length&&ids.length&&/\b(?:eliminarl[ie]|elimino|vuoi eliminare|cancellarl[ie]|cancello|vuoi cancellare)\b/.test(plain(askP.question??''))&&!/\b(?:aggiung\w*|oppure|o togliere|o eliminare|o aggiungere)\b/.test(plain(askP.question??''))&&/\b(?:si|elimin\w*|cancell\w*|conferm\w*)\b/.test(plain(text)))acts=ids.map(id=>({kind:'delete',id,soft:true}) as MenuAction) // batteria persona 2: «ok» a «…aggiungere o togliere?» eliminava 2 piatti alla carta
   else if(ids.length>=2&&(all||vis||(yes&&/\btutt[ieoa]\b/.test(plain(askP.question??'')))))acts=expand()
   else if(stored.length===1&&stored[0]!.kind==='create_section'&&answerSectionName(text)){const nm=answerSectionName(text)!,cs=stored[0] as Extract<MenuAction,{kind:'create_section'}>,ex=sections.find(x=>x.menu===cs.menuName&&sameSection(x.name,nm))
    // Il titolare sceglie un altro nome: quel sottomenu (se c'è già nel Menu, si usa quello), poi il piatto.
    acts=ex?[]:[{...cs,name:nm} as MenuAction];if(ex&&askP.draft?.name&&askP.draft.price!=null)acts=[{kind:'create',sectionId:ex.id,name:askP.draft.name,price:askP.draft.price,description:null} as MenuAction]}
   else if(yes&&stored.length&&(ids.length<2||ids.every(id=>stored.some(a=>'id' in a&&(a as any).id===id))))acts=vis?stored.filter(a=>!('id' in a)||!refs.find(r=>r.id===(a as any).id)?.hidden):stored
   else if(priceOnly&&stored.length&&stored.every(a=>a.kind==='create_section'))acts=stored
   // Prezzo detto dopo «A che prezzo metto X nei Primi?» (sottomenu già creato): il piatto si crea lì, senza altre domande.
   else if(priceOnly&&!stored.length&&!!askP.draft?.sectionId&&sections.some(x=>x.id===askP.draft!.sectionId))acts=[]
   // Bozza di piatto senza prezzo e un «sì»: serve il prezzo, chiesto con parole nuove (la domanda di prima non si ripete).
   // 22/10 (v138 dal vivo, «si» / «si voglio chiamarlo primi» dopo «A che prezzo metto Lasagna?»): un solo messaggio chiaro, ogni volta
   // diverso; al terzo giro senza prezzo si chiude con una frase utile (mai «Non ho cambiato nulla» mescolato a una domanda).
   else if(!stored.length&&askP.draft?.name&&askP.draft.price==null&&!!askP.draft.sectionId&&(yes||!!answerSectionName(text))){const sc=sections.find(x=>x.id===askP.draft!.sectionId),nm=askP.draft.name,low=nm.toLowerCase(),fresh=!!(askP.draft as any).fresh,closed=!!(askP as any).closed
    // 22/10 (v139): «è pronto» solo per un sottomenu appena creato; dopo la chiusura la bozza resta, così «lasagna 12» la completa subito.
    const q=(answerSectionName(text)&&sc?'Il sottomenu *'+safe(sc.name)+'* c\u2019è già. ':sc&&fresh?'Il sottomenu *'+safe(sc.name)+'* è pronto. ':'')+'Per mettere *'+safe(nm)+'*'+(sc&&!fresh&&!answerSectionName(text)?' nei *'+safe(sc.name)+'*':'')+' mi manca solo il prezzo: scrivimi per esempio «'+low+' 12».'
    const close='Va bene, per ora lascio *'+safe(nm)+'* fuori dal menu. Quando vuoi aggiungerlo scrivimi il prezzo, per esempio «'+low+' 12».'
    if(closed){preReply=answerSectionName(text)&&sc?'Il sottomenu *'+safe(sc.name)+'* c\u2019è già: aggiungo *'+safe(nm)+'* quando mi scrivi il prezzo, per esempio «'+low+' 12».':'Ok: aggiungo *'+safe(nm)+'* quando mi scrivi il prezzo.';if(plain(preReply)===plain(askP.question??''))preReply='Ok.';const q2=preReply;await db.transaction(async tx=>{await lock(tx,ctx.phone);await propose(tx,ctx,row.revision,{...askP,question:q2})})}
    else if((askP.rounds??1)>=3||plain(q)===plain(askP.question??'')){preReply=close;await db.transaction(async tx=>{await lock(tx,ctx.phone);await propose(tx,ctx,row.revision,{...askP,closed:true,question:close} as any)})}
    else{preReply=q;await db.transaction(async tx=>{await lock(tx,ctx.phone);await propose(tx,ctx,row.revision,{...askP,rounds:(askP.rounds??1)+1,question:q})})}}
   // notte 22/10 (QA v145 / cieco b2: «aggiungi il vitello tonnato» → «in quale sottomenu e a che prezzo?» → «14» → stessa domanda; «4»
   // → elenco senza tenere il prezzo; «sì» a una domanda a scelta → testo generico): piatto nuovo con nome e SENZA sottomenu. Il server tiene
   // ogni parte detta (prezzo, sottomenu, numero dell'elenco) e chiede SOLO ciò che manca, con parole nuove; con un sottomenu adatto lo propone.
   else if(engine==='haiku'&&!stored.length&&askP.draft?.name&&!askP.draft.sectionId&&!newCommandOverAsk(text,askP,refs)&&(partial=(():{q:string,patch:Record<string,unknown>}|{create:MenuAction}|null=>{const d=askP.draft!,opts:string[]=((askP as any).secOptions??[]).filter((id:string)=>sections.some(x=>x.id===id)),t=plain(text)
     const num=t.match(/^(?:il |la |numero )?(\d)$/),pick=num&&d.price!=null&&opts.length?opts[Number(num[1])-1]:undefined
     const okSec=(x:SectionRef)=>!fixedSecIds.has(x.id)&&base.menus.some(m=>m.name===x.menu&&m.active!==false)
     // il sottomenu (e il Menu) detti nel messaggio di adesso o nella richiesta originale («aggiungi il cacio e pepe nei primi del pranzo»).
     const both=text+' \n '+askOrigin(askP),ns0=namedSections(text,sections).ids.length?namedSections(text,sections).ids:namedSections(both,sections).ids,ms=namedMenus(both,base.menus).map(m=>m.name)
     const ns1a=ns0.filter(id=>!fixedSecIds.has(id)),ns1L=ns1a.filter(id=>{const x=sections.find(z=>z.id===id);return !!x&&base.menus.some(m=>m.name===x.menu&&m.active!==false&&(m.secs as any[]).find(z=>z.id===id)?.active!==false)}),ns1=ns1a.length>1&&ns1L.length>=1?ns1L:ns1a,ns=ns1.length>1&&ms.length===1?ns1.filter(id=>sections.find(x=>x.id===id)?.menu===ms[0]):ns1,secId=pick??(ns.length===1?ns[0]:undefined)
     const p0=d.price??(num&&opts.length&&d.price==null?Number(num[1]):onlyPrice(draftless(text,d.name)))
     const saidNow=(num&&opts.length)||namedSections(text,sections).ids.length>0||onlyPrice(draftless(text,d.name))!==null||yes
     if(!saidNow)return null
     const nm=d.name,low=nm.toLowerCase(),eur=(n:number)=>n.toFixed(2).replace('.',',')+' €',rounds=(askP.rounds??1)+1
     if(p0!=null&&p0>0&&secId)return{create:{kind:'create',sectionId:secId,name:nm,price:p0,description:null} as MenuAction}
     if(p0==null&&secId){const sc=sections.find(x=>x.id===secId)!;return{q:'A che prezzo metto *'+safe(nm)+'* in *'+safe(sc.name)+'*? Scrivimi per esempio «'+low+' 12».',patch:{rounds,draft:{...d,price:null,sectionId:secId}}}}
     // elenco: prima i sottomenu attivi con piatti dei Menu visibili alla carta, poi quelli vuoti; mai sottomenu nascosti né Menu a prezzo fisso.
     const secInfo=(x:SectionRef)=>base.menus.find(m=>m.name===x.menu)?.secs.find((z:any)=>z.id===x.id) as {active:boolean,items:number}|undefined
     const live=(x:SectionRef)=>okSec(x)&&secInfo(x)?.active!==false
     // notte 22/10 (coordinatore: «a pranzo aggiungi la panna cotta a 5» → elenco con i sottomenu della CENA): con UN Menu detto, solo i suoi.
     const inMs=(arr:SectionRef[])=>{const f=ms.length===1?arr.filter(x=>x.menu===ms[0]):arr;return f.length?f:arr}
     const course=dishCourse(nm),fit=course?inMs(sections.filter(x=>live(x)&&sameSection(x.name,course))).filter(x=>ms.length!==1||x.menu===ms[0]):[],cands=inMs(sections.some(x=>live(x)&&(secInfo(x)?.items??0)>0)?sections.filter(x=>live(x)&&(secInfo(x)?.items??0)>0):sections.filter(live)).slice(0,6) // fase 3: mai sottomenu vuoti in elenco (QA v149 «Completo (Menu pranzo)»)
     const head=p0!=null&&p0>0?'Ok, *'+eur(p0)+'*. ':''
     if(fit.length===1&&p0!=null&&p0>0){const sc=fit[0]!;return{q:head+'Metto *'+safe(nm)+'* in *'+safe(sc.name)+'*'+(base.menus.length>1?' (Menu *'+safe(sc.menu.replace(/^men[uù]\s+/i,''))+'*)':'')+'? Rispondi *sì* oppure dimmi il sottomenu giusto.',patch:{rounds,actions:[{kind:'create',sectionId:sc.id,name:nm,price:p0,description:null}],draft:{...d,price:p0}}}}
     const list=cands.map((x,i)=>(i+1)+'. *'+safe(x.name)+'* ('+safe(x.menu)+')').join('\n'),again=!!(askP as any).secOptions
     // notte 22/10: «ok»/«sì» senza un sottomenu detto non ripete la stessa domanda con l'elenco: chiede solo il nome, breve.
     if(yes&&again&&!namedSections(text,sections).ids.length&&cands.length)return{q:'Mi serve il sottomenu: scrivimi il nome, per esempio *'+safe(cands[0]!.name)+'*, oppure il numero dell’elenco.',patch:{rounds,secOptions:cands.map(x=>x.id),draft:{...d,price:p0??null}}}
     return{q:(again?'Scegli il sottomenu per *'+safe(nm)+'*'+(p0!=null&&p0>0?' ('+eur(p0)+')':'')+': rispondi col numero o col nome.':head+'In quale sottomenu metto *'+safe(nm)+'*?'+(p0==null?' E a che prezzo?':'')+' Rispondi col numero o col nome.')+'\n\n'+list,patch:{rounds,secOptions:cands.map(x=>x.id),draft:{...d,price:p0??null}}}})())){
    if('create' in partial)pre={actions:[partial.create],why:'risposta'}
    else{const pt=partial;await db.transaction(async tx=>{await lock(tx,ctx.phone);await propose(tx,ctx,row.revision,{...askP,question:pt.q,...pt.patch} as any)});preReply=pt.q}}
   // Un «sì» a una domanda senza niente da eseguire (né azioni, né candidati, né bozza): mai «Non ho cambiato nulla», la domanda si chiude.
   else if(yes&&!stored.length&&!ids.length&&!askP.draft?.name){preReply='Non c\u2019è niente da confermare: dimmi pure cosa vuoi cambiare, per esempio «la carbonara a 12».';closePend=true}
   if(acts&&(acts.length||priceOnly)){let follow:Follow|null=null;const cs=acts.find(a=>a.kind==='create_section') as Extract<MenuAction,{kind:'create_section'}>|undefined,d=askP.draft
    if(d?.name&&!acts.some(a=>a.kind==='create')){const price=priceOnly?onlyPrice(draftless(text,d.name))!:d.price,secId=cs?.newSectionId??d.sectionId
     if(secId&&price!=null&&price>0)acts=[...acts,{kind:'create',sectionId:secId,name:d.name,price,description:null} as MenuAction]
     else if(cs)follow={name:d.name,sectionId:cs.newSectionId,sectionName:cs.name,origin}}
    if(cs&&acts.some(a=>a.kind==='create'))acts=acts.map(a=>a===cs?{...cs,hidden:false} as MenuAction:a)
    const yesDel=yes&&acts.length>0&&acts.every(a=>a.kind==='delete')&&/\b(?:eliminarl[ie]|elimino|vuoi eliminare|cancellarl[ie]|cancello|vuoi cancellare)\b/.test(plain(askP.question??''))&&/\b(?:si|elimin\w*|cancell\w*|conferm\w*)\b/.test(plain(text))
    pre={actions:yesDel?acts.map(a=>({...a,soft:true}) as MenuAction):acts,why:yesDel?'risposta-elimina':'risposta',follow}}
   // notte 22/10 (n-annulla-lascia-stare): «lascia stare» su una domanda aperta la chiude con un testo fisso (prima il modello, senza più
   // nulla in sospeso, rispondeva con un’altra domanda).
   else if(newCommandOverAsk(text,askP,refs)){closePend=true;if(engine==='haiku'&&pureDrop(text))preReply=dropText}}
  else if(askP&&askP.twins?.length&&newCommandOverAsk(text,askP,refs))closePend=true
  if(!pre&&!preReply&&!sessNow&&visibleOnly(text)&&/\b(?:solo|solamente|soltanto|unicamente)\b/.test(plain(text))&&last&&(!pend||closePend)){const back=last.undo.filter(a=>'id' in a&&a.kind==='price'&&refs.find(r=>r.id===(a as any).id)?.hidden);if(back.length)pre={actions:back,why:'solo_visibili'}}
  // fase 3 (QA v149b: «4» → creato → «nei Piatti di prova» → «Quale piatto…?» → «annulla» → «non ho cambiato nulla» = FALSO): «annulla» su
  // una domanda aperta la chiude; se la domanda segue una scrittura di pochi minuti fa SULLO STESSO argomento (piatto scritto, o sottomenu
  // di un piatto appena creato, nominato nella domanda o nella richiesta che l'ha fatta nascere), annulla anche quella scrittura.
  // QA v153 22/10 (vietato-elimina-primi, GRAVE): «no» alla domanda «Quali primi vuoi eliminare: *Pasta al sugo*…?» annullava la modifica
  // di prima sulla Pasta al sugo (undoRequested accetta un «no» secco). Qui solo una richiesta ESPLICITA di annullo: un rifiuto chiude la domanda.
  if(engine==='haiku'&&askP&&!pre&&!preReply&&!sessNow&&explicitUndoRequested(text)&&plain(text).split(' ').length<=4&&!(askP.actions??[]).length&&!(askP as any).session&&!!undoRec&&!undoRec.full&&Date.now()-Number(undoRec.at)<=3*60*1000){const about=' '+plain(String(askP.question??'')+' '+String(askP.source??''))+' '
   if(undoRec.items.some(i=>[String(i.after?.name??i.before?.name??''),!i.before?sections.find(x=>x.id===i.sectionId)?.name??'':''].map(plain).some(k=>k.length>=3&&about.includes(' '+k+' ')))){pre={actions:[],why:'annulla'};closePend=true}}
  // 23/10 (batteria v186b): risposta che nomina ESATTAMENTE uno dei candidati della domanda «quale?» («la pasta al pesto dei primi») =
  // l'azione della richiesta di prima su quel piatto, decisa dal server prima del modello (prima: a volte la stessa domanda di nuovo).
  if(engine==='haiku'&&askP&&!pre&&!preReply&&!sessNow&&!closePend&&!askP.twins?.length&&(askP.ids??[]).length>=2&&!(askP.actions??[]).length){const cands=refs.filter(r=>(askP.ids??[]).includes(r.id)),t=' '+plain(text).replace(/\b(?:il|lo|la|i|gli|le|l)\s+/g,' ')+' ',ex=cands.filter(r=>{const n=plain(r.name).replace(/^(?:il|lo|la|i|gli|le|l)\s+/,'');return n.length>=4&&t.includes(' '+n+' ')}),top=ex.filter(r=>!ex.some(o=>o.id!==r.id&&plain(o.name).includes(plain(r.name))))
   if(top.length===1&&!CMD_RE_NEW.test(plain(text))){const vt=askOrigin(askP)+' \n '+text,act=pronounAct(top[0]!,vt);if(act&&(act.kind!=='price'||((act as any).price>0&&!oddPrice(act,refs)))){pre={actions:[act],why:'risposta'};closePend=true}}}
  if(closePend){pend=null;answered=false;(base as any).pendingCommand=null}
  if(pre)answered=true}
 // notte 22/10 (n-sessione-lunga): «fatto?», «hai fatto?», «tutto a posto?» = conferma di ciò che è già stato scritto (prima la scheda di un piatto).
 if(engine==='haiku'&&!preReply&&!pre&&!sessNow&&!pend&&/\?\s*$/.test(text)&&/^(?:e |allora |quindi |ok )?(?:hai |e )?(?:fatto|fatto tutto|tutto fatto|tutto ok|tutto a posto|pubblicato|l hai fatto|li hai fatti|le hai fatte|l hai messo|fatto bene)$/.test(plain(text)))preReply=last?'Sì: le modifiche di prima sono online, non c’è altro in sospeso.'+(undoOK?' '+UNDO_HINT:''):'Non c’è nessuna modifica in corso: dimmi pure cosa vuoi cambiare.'
 // notte 22/10 (z-interruzioni-011 «elimina il babà e il tiramisù» → «solo il babà» → «sì»): su un'eliminazione in attesa, «solo X» restringe
 // la proposta ai piatti detti (sempre in attesa del sì); prima diventava una domanda senza azioni e il «sì» girava a vuoto.
 if(engine==='haiku'&&!preReply&&!pre&&!sessNow&&pend?.kind==='batch'&&pend.why==='delete'&&/\b(?:solo|soltanto|solamente)\b/.test(plain(text))&&!/\b(?:no|non|anche|pure)\b/.test(plain(text))&&plain(text).split(' ').length<=8){
  const dels=pend.actions.filter(a=>a.kind==='delete') as Extract<MenuAction,{kind:'delete'}>[],keep=dels.filter(a=>{const r=refs.find(x=>x.id===a.id);return !!r&&g9DishMentioned(r.name,text,refs)})
  if(keep.length&&keep.length<dels.length){const nm=keep.map(a=>'*'+safe(refs.find(x=>x.id===a.id)!.name)+'*').join(' e ');await db.transaction(async tx=>{await lock(tx,ctx.phone);await propose(tx,ctx,row.revision,{kind:'batch',actions:keep,requiresTypedOk:true,why:'delete'})})
   preReply='Elimino solo '+nm+'? Rispondi *sì*.\n\n'+pendingFacts('delete',keep,refs,sections)}}
 // notte 22/10 (cc-giornata-05 «elimina i rigatoni con la pajata» → «sì» → «quanto costa la pajata?» → «rimetti i rigatoni con la pajata» →
 // «14 euro nei primi»): un piatto ELIMINATO da poco (30 minuti) è un fatto del server. Domanda su di lui = «l'hai eliminato»; «rimettilo» =
 // proposta di ricrearlo com'era (sottomenu e prezzo di prima) col sì; un prezzo / sottomenu detto dopo la proposta la completa.
 if(engine==='haiku'&&!preReply&&!pre&&!sessNow){const askR=pend?.kind==='ask'?(pend.ask as any):null
  if(askR?.restoreOf&&!CMD_RE_NEW.test(plain(text).replace(/\b(?:aggiung|rimett)\w*\b/g,' '))){const sp=singlePrice(text),ns=namedSections(text,sections).ids,ro=askR.restoreOf as {name:string,price:number,sectionId:string|null,description:string|null}
   const secId=ns.length===1?ns[0]!:ro.sectionId&&sections.some(x=>x.id===ro.sectionId)?ro.sectionId:null
   if(sp!==null&&sp>0&&secId){pre={actions:[{kind:'create',sectionId:secId,name:ro.name,price:sp,description:ro.description} as MenuAction],why:'ripristino'};closePend=true;pend=null;(base as any).pendingCommand=null}}
  else if(!pend){const gone=((restorable?.items??[]) as any[]).filter(i=>i.before&&typeof i.before.name==='string'&&!refs.some(r=>r.id===i.id)&&!refs.some(r=>sameDishName(r.name,i.before.name)))
   const hit=gone.filter(i=>{const n=plain(i.before.name),t=' '+plain(text)+' ';return t.includes(' '+n+' ')||n.split(' ').filter((w:string)=>w.length>=5&&!refs.some(r=>(' '+plain(r.name)+' ').includes(' '+w+' '))).some((w:string)=>t.includes(' '+w+' '))}) // 23/10: una parola comune a piatti presenti («pasta») non indica il piatto eliminato
   // 24/10 (batteria: «togli la lasagna» → «rimettila» → «Vuoi annullare…?»): il pronome dopo un'eliminazione recente = quel piatto (uno
   // solo col singolare, tutti quelli appena eliminati col plurale).
   {const pp=plain(text).replace(/^(?:(?:no|scusa|anzi|ok|allora|dai|si)\s+)*/,'');const pr=/^(?:rimett|riport|ripristin)\w*?(l[aoie])(?:\s+(?:nel menu|com era|come prima|dai|per favore|subito))*$/.exec(pp)
    const lastSnap=undoRec&&Date.now()-Number(undoRec.at)<=10*60*1000?JSON.stringify((undoRec as any).full?.before??null)+JSON.stringify(undoRec.items??[]):'',last=lastSnap?gone.filter((i:any)=>lastSnap.includes(String(i.id))):[] // solo l'ultima pubblicazione (mai un'eliminazione di prima)
    if(pr&&!hit.length){if(/l[ao]$/.test(pr[1]!)&&last.length===1)hit.push(last[0]);else if(/l[ie]$/.test(pr[1]!)&&last.length>=1&&last.length<=4)hit.push(...last)}}
   const fixedSec=(id:string|null|undefined)=>{const sc=sections.find(x=>x.id===id);return !!sc&&base.menus.some(m=>m.name===sc.menu&&m.pricing==='fisso')}
   // nel Menu a prezzo fisso il piatto non ha prezzo: si rimette subito nel suo sottomenu (prima chiedeva «scrivimi prezzo e sottomenu»)
   if(hit.length>=1&&hit.every((i:any)=>fixedSec(i.sectionId))&&(/\b(?:rimett\w*|ripristin\w*|riaggiung\w*|rimetti\w*|torna\w*|riport\w*)\b/.test(plain(text)))&&!/\b(?:non|niente)\b/.test(plain(text)))pre={actions:hit.map((i:any)=>({kind:'create',sectionId:i.sectionId,name:String(i.before.name),price:0,description:i.before.description??null,noPrice:true}) as MenuAction),why:'ripristino'}
   else if(hit.length===1){const i=hit[0],nm=String(i.before.name),sec=sections.find(x=>x.id===i.sectionId),old=Number(i.before.price)||0,eur=(n:number)=>n.toFixed(2).replace('.',',')+' €'
    // notte 22/10 fase 3 (QA v149 GRAVE «aggiungi patatine fritte a 4» → creato subito nei *Piatti di prova*): il piatto era stato eliminato
    // 25 minuti prima in un'ALTRA conversazione; «aggiungi» è un piatto nuovo (il sottomenu si chiede), solo «rimetti / ripristina /
    // riaggiungi / torna» riporta il piatto eliminato com'era.
    if(/\b(?:rimett\w*|ripristin\w*|riaggiung\w*|rimetti\w*|torna\w*)\b/.test(plain(text))&&!/\b(?:non|niente)\b/.test(plain(text))){const sp=singlePrice(text),ns=namedSections(text,sections).ids,secId=ns.length===1?ns[0]!:sec?.id??null
     if(sp!==null&&sp>0&&secId)pre={actions:[{kind:'create',sectionId:secId,name:nm,price:sp,description:i.before.description??null} as MenuAction],why:'ripristino'}
     else{const q=secId&&old>0?'*'+safe(nm)+'* l\u2019hai eliminato poco fa. Lo rimetto nei *'+safe(sections.find(x=>x.id===secId)!.name)+'* a *'+eur(old)+'* come prima? Rispondi *sì*, oppure scrivimi prezzo e sottomenu (per esempio «14 euro nei primi»).':'*'+safe(nm)+'* l\u2019hai eliminato poco fa. Per rimetterlo scrivimi prezzo e sottomenu, per esempio «14 euro nei primi».'
      const acts=secId&&old>0?[{kind:'create',sectionId:secId,name:nm,price:old,description:i.before.description??null} as MenuAction]:[]
      await db.transaction(async tx=>{await lock(tx,ctx.phone);await propose(tx,ctx,row.revision,{kind:'brain_ask',question:q,ids:[],actions:acts,source:text.slice(0,600),origin:text.slice(0,600),rounds:1,restoreOf:{name:nm,price:old,sectionId:secId,description:i.before.description??null}} as any)});preReply=q}}
    else if(/\?\s*$/.test(text)||/^(?:quanto|che|cosa|c e|dov e|e il|e la)\b/.test(plain(text)))preReply='*'+safe(nm)+'* l\u2019hai eliminato poco fa: non è più nel menu. Per rimetterlo scrivimi «rimetti '+nm.toLowerCase()+'».'}}}
 // notte 22/10 (bv-domande-006 «che locale ho?» → «Il tuo locale è Tako. Nel menu hai il Menu…? No: …»): il nome del locale è un fatto: lo dice il server.
 if(engine==='haiku'&&!preReply&&!pre&&!sessNow&&name&&/^(?:ciao |scusa |senti )?(?:che|quale|qual e il|qual e) (?:locale|ristorante) (?:ho|e|e il mio|gestisco|sto modificando)\b|\bcome si chiama il (?:mio )?(?:locale|ristorante)\b/.test(plain(text))&&plain(text).split(' ').length<=9)preReply='Il tuo locale è *'+safe(name)+'*. Dimmi pure cosa vuoi cambiare nel menu.'
 // notte 22/10 (cc-foglio-01/02): listino incollato con i prezzi dei piatti del menu → lo legge il server (mai 30 azioni scritte dal modello).
 let sheetNote=''
 if(engine==='haiku'&&!preReply&&!pre&&!sessNow&&!pend){const sh=priceSheet(text,refs);if(sh){sheetNote=[sh.unmatched.length?'Non trovo nel menu, quindi non li ho toccati: '+sh.unmatched.slice(0,8).map(n=>'*'+safe(n)+'*').join(', ')+'.':'',sh.same?sh.same+' prezzi sono già uguali.':''].filter(Boolean).join(' ');if(sh.actions.length)pre={actions:sh.actions,why:'foglio'};else preReply=['Ho controllato il listino: i prezzi sono già tutti così, non ho cambiato nulla.',sheetNote].filter(Boolean).join('\n\n')}}
 // notte 22/10 (cc-vietato-15): percentuale su un gruppo («alza tutti i prezzi del 50%», «sconta le pizze del 10%»): la legge il server
 // PRIMA del modello (che scriveva un'azione per piatto e finiva i token). Poi i vincoli soliti: oltre 3 piatti o cambi enormi = riepilogo + OK.
 if(engine==='haiku'&&!preReply&&!pre&&!sessNow&&!pend&&groupPercent(text)){const g=seraGroup(text,refs,sections,fixedSecIds,{menus:base.menus})
  if(g&&'actions' in g)pre={actions:g.actions,why:'gruppo'}
  else if(g&&'ask' in g)preReply=(/e$/i.test(g.label.trim())?'Le':'I')+' *'+safe(g.label)+'* ci sono in più Menu: in quale? '+g.menus.map(x=>'*'+safe(x)+'*').join(' o ')+'?'}
 // fase 3 (memoria a breve; QA v149b «quanto costa la pasta carbonara?» → «mettila a 10» → «A quale piatto metto 10 €?»): pronome singolare
 // + un valore leggibile + UN solo piatto nell'ultima risposta del bot (lettura o scrittura, ≤10 minuti) = l'azione su quel piatto, decisa
 // dal server PRIMA del modello (qualunque cosa il modello risponda). Mai piatti di scambi più vecchi.
 if(engine==='haiku'&&!preReply&&!pre&&!sessNow&&!pend){const pt=plain(text)
  if((ONE_PRONOUN.test(pt)||/^(?:anzi |no |ok |e |ah )?(?:(?:e|è|sono|so|e gia) )?(?:finit\w*|esaurit\w*|tornat\w*)$/.test(pt))&&!/\b(?:prima|precedente|altr[oaie]|e poi|poi|anche|evidenz\w*|promo|per ?cento|aggiung\w*|nuov[oa]|locale|ristorante|tutt[ieoa]|non|nun)\b|%|\?/.test(pt+' '+text)&&(pt.match(/\b(?:alz|abbass|aument|diminu|scont|mett|port|togli|nascond|lev|segn|rimett|evidenz|aggiung|elimin|cancell|sposta|rinomin)\w*/g)??[]).length<=1&&!refs.some(r=>g9DishMentioned(r.name,text,refs))){
   const lb=await lastBotTurn(db,ctx.tenant,ctx.phone)
   if(process.env.TAKO_BRAIN_DEBUG)void import('node:fs').then(fs=>fs.appendFileSync(String(process.env.TAKO_BRAIN_DEBUG),'PRONOME '+JSON.stringify({text,lb:lb?{t:lb.text.slice(0,160),age:Date.now()-lb.at}:null})+'\n')).catch(()=>{})
   if(lb&&Date.now()-lb.at<=10*60*1000&&!/\*eliminato\*/i.test(lb.text)){const t=' '+plain(lb.text)+' ',n0=refs.filter(r=>plain(r.name).length>=3&&t.includes(' '+plain(r.name)+' ')),nm1=n0.filter(r=>!n0.some(o=>o.id!==r.id&&plain(o.name).includes(plain(r.name))))
    const one=nm1.length===1?nm1[0]!:null,act=one&&!(fixedSecIds.has(one.sectionId??'')&&!/\b(?:finit|esaurit|tornat|nascond|togli|lev[ai]|rimett)\w*/.test(pt))?pronounAct(one,text):null
    if(act&&(act.kind!=='price'||((act as any).price>0&&!oddPrice(act,refs))))pre={actions:[act],why:'pronome'}
    // 24/10 (aperto dal 23/10: «mettila a 5 euro» su un piatto di Menu a prezzo fisso → «A quale piatto metto 5 €?»): lo si spiega.
    else if(one&&fixedSecIds.has(one.sectionId??'')&&singlePrice(text)!==null&&!/\b(?:finit|esaurit|tornat|nascond|togli|lev[ai]|rimett)\w*/.test(pt))preReply=fixedDishPriceText(one,base.menus)}}}

 // 24/10 (batteria: «la cotoletta è finita» → «Intendi la Cotoletta del Menu Giorno, la Cotoletta di pollo o di nodino?»): il nome detto
 // è il nome INTERO di un solo piatto visibile (gli altri lo contengono soltanto) → finito subito, deciso dal server, senza domanda.
 if(engine==='haiku'&&!preReply&&!pre&&!sessNow&&!pend){const m=/^(?:(?:ok|allora|scusa|guarda|e|ed|anche|ah|oh|senti|ehm)\s+)*(?:il|lo|la|i|gli|le|l)?\s*(.+?)\s+(?:e|sono|so)\s+(?:gia\s+)?(?:finit[oaie]|esaurit[oaie]|terminat[oaie])(?:\s+(?:per oggi|oggi|stasera|per stasera))?$/.exec(plain(shorthand(text)))
  if(m&&!/\d|\?|,/.test(text)){const said=m[1]!.replace(/\s+(?:del|della|a|al|nel|nella|per il|per la|di)\s+(?:menu\s+)?(?:pranzo|cena|giorno|sera|mezzogiorno|stasera|carta)$/,'').trim(),ms=menusIn(text,base.menus)
   const pool=refs.filter(r=>!r.hidden&&(!ms.length||ms.some(x=>x.name===r.menu))),hit=pool.filter(r=>sameDishName(r.name,said))
   if(said.split(' ').length<=6&&!/\b(?:e|anche|tutt[ieoa]|non)\b/.test(said)&&hit.length===1&&hit[0]!.available!==false)pre={actions:[{kind:'available',id:hit[0]!.id,value:false} as MenuAction],why:'finito'}}}
 // 24/10: prezzo detto per un piatto che c'è SOLO in Menu a prezzo fisso («la lasagna costa 7», «porta la cotoletta a 6»): niente prezzo sul
 // piatto (lo paga l'opzione), lo spiega il server; mai «A quale piatto metto 7 €?». Con un omonimo alla carta decide il resto del flusso.
 if(engine==='haiku'&&!preReply&&!pre&&!sessNow&&!pend){const pt=plain(text),sp=singlePrice(text)
  if(sp!==null&&sp>0&&!/\b(?:complet\w*|solo primo|solo secondo|opzion\w*|formul\w*|fisso|carta|aggiung\w*|inser\w*|nuov[oa]|crea\w*|tutt[ieoa]|menu|quant\w*|qual\w*|cosa|finit\w*|esaurit\w*|alz\w*|abbass\w*|aument\w*|diminu\w*|scont\w*)\b|%|\?/.test(pt)){
   const named=refs.filter(r=>!r.hidden&&fullyNamed(r.name,text)),longest=named.filter(r=>!named.some(o=>o.id!==r.id&&plain(o.name).includes(plain(r.name))&&plain(o.name)!==plain(r.name)))
   if(longest.length>=1&&longest.every(r=>fixedSecIds.has(r.sectionId??''))&&new Set(longest.map(r=>plain(r.name))).size===1&&!refs.some(r=>!fixedSecIds.has(r.sectionId??'')&&!r.hidden&&sameDishName(r.name,longest[0]!.name)))preReply=fixedDishPriceText(longest[0]!,base.menus)}}
 // notte 22/10 (primo contatto, demo): «cosa sai fare?», «come funziona?», «aiuto» → cosa sa fare, dal server; «posso cambiare i prezzi
 // da qui?» (senza piatto né numero) → «Sì» + un esempio della cosa chiesta. Il modello non riceve queste domande.
 if(engine==='haiku'&&!preReply&&!pre&&!sessNow){const hp=plain(shorthand(text)).replace(/^(?:(?:ciao|buongiorno|buonasera|salve|ehi|senti|scusa|ok)\s+)+/,'').trim()
  if(/^(?:(?:ma |e )?(?:cosa|che cosa|che) (?:sai|puoi|posso|si puo) fare(?: (?:qui|da qui|con te|per me|col bot|in chat))?|come funziona(?: (?:qui|il bot|la chat|questa chat))?|come ti uso|come si usa|(?:aiuto|help|istruzioni|comandi)(?: per favore)?|a cosa servi|chi sei e cosa fai|(?:ma )?come si fa|(?:ma )?come faccio|non (?:ci )?capisco(?: niente| nulla)?|non ho capito(?: niente| nulla| come si fa)?|non so come (?:si fa|fare)|che (?:devo|posso) (?:fare|scrivere)|aiutami|mi aiuti|come funziona sta cosa|boh come si fa)$/.test(hp.replace(/[?!.]+$/,'').trim()))preReply=copy.brainHelp
  else if(/\?\s*$/.test(text)&&!/\d/.test(text)&&!refs.some(r=>g9DishMentioned(r.name,text,refs))){const m=/^(?:ma |e |allora )?(?:posso|si puo|si possono|puoi|potresti|riesci a|sei capace di|e possibile) (?:anche )?(cambi\w*|modific\w*|aggiorn\w*|aggiung\w*|cre\w*|inser\w*|togli\w*|nascond\w*|lev\w*|mostr\w*|spost\w*|rinomin\w*|segn\w*|mett\w*|legg\w*|vede\w*|annull\w*|elimin\w*)\b/.exec(hp)
   if(m){const v=m[1]!,ex=/^(?:aggiung|cre|inser)/.test(v)?'«aggiungi la panna cotta a 5 nei Dolci»':/^(?:togli|nascond|lev)/.test(v)?'«nascondi il tiramisù»':/^mostr/.test(v)?'«rimetti il tiramisù nel menu»':/^spost/.test(v)?'«sposta il tiramisù nei Dolci»':/^rinomin/.test(v)?'«rinomina il Menu pranzo in Pranzo veloce»':/^(?:legg|vede)/.test(v)?'«cosa c’è nei Primi?»':/^annull/.test(v)?'«annulla»':/^elimin/.test(v)?'«elimina il tiramisù» (ti chiedo il sì prima)':/^segn/.test(v)&&/finit|esaurit/.test(hp)?'«il tiramisù è finito»':/finit|esaurit|disponibil/.test(hp)?'«il tiramisù è finito»':'«la carbonara a 12»'
    preReply='Sì, basta scrivermelo qui, anche con un vocale. Per esempio '+ex+'.'}}}
 // notte 22/10 (SICUREZZA cc-prezzo-03 «il caffè a -5» → scritto 5 €: il modello perde il segno): un importo col meno davanti non è mai un
 // prezzo; nessuna scrittura, si chiede (le percentuali «-20%» e gli intervalli «10-12» restano al resto della catena).
 if(engine==='haiku'&&!preReply&&!pre&&!sessNow){const neg=/(?:^|[\s(:=,])[-\u2212\u2013]\s?(\d+(?:[.,]\d+)?)(?!\s*(?:%|per ?cento|\d))/.exec(text)
  if(neg){const fixed=text.replace(/(^|[\s(:=,])[-\u2212\u2013]\s?(\d)/,'$1$2').trim();preReply='Un prezzo non può essere negativo, quindi *non ho cambiato nulla*. Intendevi «'+safe(fixed)+'»?'}}
 // notte 22/10 (qa-continua live: «elimina il vitello tonnato» appena creato → il modello indica *la parmigiana*): «elimina/cancella X» con X
 // il nome intero di UN solo piatto = eliminazione di quel piatto, decisa dal server (serve comunque il sì del titolare).
 // 23/10 (persona «scrive malissimo»): «anzi no la lasagna nn la mettere» subito dopo averla creata = tolta (era appena aggiunta), senza
 // domande; «togli la carbo» con UN solo piatto di quel nome = eliminato subito (annulla 10 minuti). Mai su piatti di nome diverso.
 // 28/10 (giornata Luisa: «nei primi metti … lasagna» → «si si» → «anzi no la lasagna nn la mettere» → «Ok, lascio stare»): una domanda
 // in sospeso SENZA azioni pronte (es. «Cosa vuoi cambiare?») non blocca queste regole sui piatti appena creati.
 const emptyAsk=pend?.kind==='ask'&&!(pend.ask as any).actions?.length&&!(pend.ask as any).draft&&!(pend.ask as any).session
 if(engine==='haiku'&&!preReply&&!pre&&!sessNow&&(!pend||emptyAsk)){const st=plain(shorthand(text))
  // 28/10 (giornata Luisa): dopo «togli i primi» + «metti carbo amatri e lasagna» l'annulla è un'istantanea del Menu: i piatti nuovi si
  // ricavano da lì (fresh2), come per il pronome qui sotto; prima la regola li vedeva solo con l'annulla per piatto.
  const snapTxt=undoOK&&(undoRec as any)?.full?JSON.stringify((undoRec as any).full.before??null):'',fresh2=snapTxt?new Set(refs.filter(r=>!snapTxt.includes(r.id)&&base.menus.some(m=>m.name===r.menu&&snapTxt.includes(m.id))).map(r=>r.id)):freshIds // con l'istantanea del Menu (regole): nuovi = non c'erano prima
  if(fresh2.size&&/\b(?:non|nn)\s+(?:(?:la|lo|li|le|ce|ci)\s+)?(?:mett\w*|aggiung\w*|inser\w*|vogli\w*)|\b(?:anzi no|toglil[aoie]|leval[aoie]|non metterl[aoie])\b/.test(st)){const hit=refs.filter(r=>fresh2.has(r.id)&&fullyNamed(r.name,shorthand(text)))
   if(hit.length===1)pre={actions:[{kind:'delete',id:hit[0]!.id,soft:true,undoCreate:true} as MenuAction],why:'risposta-elimina'}}
  // 24/10 (batteria: «togli la lasagna metti rigatoni» → «toglili» → «Intendi Rigatoni o Lasagna?»): solo il pronome subito dopo aver
  // creato piatti = quei piatti (singolare: uno solo appena creato; plurale: tutti quelli appena creati, max 4). Mai quelli eliminati.
  if(!pre&&fresh2.size){const pr=/^(?:(?:no|anzi|scusa|ok|allora)\s+)*(?:toglil([aoie])|leval([aoie])|eliminal([aoie])|cancellal([aoie])|non (?:l[aoie]|li|le) (?:volevo|mettere))$/.exec(st)
   const fr=refs.filter(r=>fresh2.has(r.id)&&!r.hidden),g=pr?(pr[1]??pr[2]??pr[3]??pr[4]??(/\b(?:li|le)\b/.test(st)?'i':'a')):''
   if(pr&&fr.length&&(/[ao]/.test(g)?fr.length===1:fr.length<=4))pre={actions:fr.map(r=>({kind:'delete',id:r.id,soft:true,undoCreate:true}) as MenuAction),why:'risposta-elimina'}}
  if(!pre){const m=/^(?:(?:ok|allora|anzi|no|ora|adesso|e|poi)\s+)*(?:togli|toglimi|leva|levami|elimina|cancella)\s+(.+)$/.exec(st)
   if(m&&!/\d|,/.test(text)&&!/\b(?:e|anche|pure|tutt[ieoa]|sottomenu|menu|sezione|categoria|poi|non|prima|precedente|ultim[oa]|foto)\b/.test(m[1]!)){const said=m[1]!.replace(/^(?:il|lo|la|i|gli|le|l)\s+/,'').replace(/\s+(?:dal|dalla|dai|nel|nei|del|della|a|al|alla)\s.*$/,'').trim(),hit=refs.filter(r=>sameDishName(r.name,said))
    if(said.length>=3&&hit.length===1&&/^(?:togli|toglimi|leva|levami)\b/.test(m[0]!.replace(/^(?:(?:ok|allora|anzi|no|ora|adesso|e|poi)\s+)*/,'')))pre={actions:[{kind:'delete',id:hit[0]!.id,soft:true} as MenuAction],why:'risposta-elimina'}}}}
 if(engine==='haiku'&&!preReply&&!pre&&!sessNow&&!pend){const m=/^(?:ok |allora |ora |adesso )?(?:elimina|cancella|eliminami|cancellami)\s+(.+)$/.exec(plain(text))
  if(m&&!/\d|,/.test(text)&&!/\b(?:e|anche|pure|tutt[ieoa]|sottomenu|menu|sezione|categoria|poi|non|prima|precedente|ultim[oa])\b/.test(m[1]!)){const said=m[1]!.replace(/^(?:il|lo|la|i|gli|le|l)\s+/,'').replace(/\s+(?:dal|dalla|nel|nei) .*$/,'').trim(),hit=refs.filter(r=>sameDishName(r.name,said))
   if(said.length>=3&&hit.length===1){const act={kind:'delete',id:hit[0]!.id} as MenuAction;await db.transaction(async tx=>{await lock(tx,ctx.phone);await propose(tx,ctx,row.revision,{kind:'batch',actions:[act],requiresTypedOk:true,why:'delete'})});preReply='Elimino *'+safe(hit[0]!.name)+'* dal menu? Rispondi *sì*.\n\n'+pendingFacts('delete',[act],refs,sections)}}}
 if(preReply){if(closePend)await db.execute(sql`DELETE FROM tako_whatsapp_proposals WHERE phone=${ctx.phone}`);return preReply}
 let run:NonNullable<Awaited<ReturnType<typeof brainPlan>>>|null=pre?({decision:{path:'brain',intent:'change',plan:{type:'change',actions:pre.actions},exclude:[],aliasesUsed:[],replyDraft:'',notes:['sera:'+pre.why],usage:{},tokens:{},control:[],raw:{intent:'change',actions:[]},content:'',draft:''},clarifyIds:null,ownerRecent:'',lastBot:''} as any):await brainPlan(db,base);if(budget.expired)return '';if(!run)return down()
 let calls=pre?0:1
 let out:Outcome=pre?(pre.why==='annulla'?{kind:'undo'}:pre.why==='conferma'?{kind:'confirm',extra:[]}:{kind:'change',actions:pre.actions}):decide(run)
 // notte 22/10 (cc-giornata-06): «annulla» quando non c'è più niente da annullare (già annullato o oltre 10 minuti): testo fisso,
 // mai l'auto-correzione che diventava «Per "annulla" intendi Gricia?».
 if(engine==='haiku'&&out.kind==='reject'&&out.reason===reasonText(['annulla_scaduto'])&&undoRequested(text)&&plain(text).split(' ').length<=5&&!pend)return 'Non c\u2019è niente da annullare: l\u2019ultima modifica è già stata annullata, oppure sono passati più di 10 minuti. Dimmi pure cosa vuoi cambiare.'
 if(out.kind==='reject'||needsText(out,run)){
  const candNames=out.kind==='reject'?[...new Set(out.ids)].map(id=>refs.find(r=>r.id===id)?.name).filter((n):n is string=>!!n).slice(0,8):[]
  const reason=(out.kind==='reject'?out.reason:reasonText(['domanda_mancante']))+(candNames.length>1?' — piatti possibili: '+candNames.join(', '):'')
  if(process.env.TAKO_BRAIN_DEBUG)void import('node:fs').then(fs=>fs.appendFileSync(String(process.env.TAKO_BRAIN_DEBUG),'R-RIFIUTO '+JSON.stringify({text,reason,raw:run!.decision.content?.slice(0,400)})+'\n')).catch(()=>{})
  const first=out,run2=await brainPlan(db,{...base,correction:{previous:run.decision.content??'',reason}});calls++;if(budget.expired)return '';if(!run2)return down()
  const out2=decide(run2);run=run2
  // Ancora rifiutato: il modello formula una domanda (la sua bozza), mai una scrittura; i candidati restano in sospeso.
  // R8: una proposta da confermare (riepilogo/eliminazione) senza domanda nella bozza dopo l'auto-correzione non è un fallimento:
  // la domanda la portano i fatti della proposta («Non ancora pubblicato, da confermare con OK:»), la bozza che dice «fatto» cade.
  if(out2.kind==='change'&&needsText(out2,run2)&&approval(out2.actions,refs,text,answered))out=out2
  else if(out2.kind==='reject'||needsText(out2,run2)){const f=out2.kind==='reject'?out2:first.kind==='reject'?first:{kind:'reject' as const,reason,ids:[],actions:[]};out={kind:'ask',ids:f.ids.length?f.ids:first.kind==='reject'?first.ids:[],actions:f.actions,...(f.hold?{hold:f.hold}:{})}}
  // La domanda del modello dopo il rifiuto: se non indica i piatti, valgono i candidati del validatore.
  else out=out2.kind==='ask'&&!out2.ids.length&&!out2.hold&&first.kind==='reject'&&first.ids.length>1?{...out2,ids:first.ids,actions:out2.actions.length?out2.actions:first.actions}:out2
  if(out.kind==='ask'&&!out.createDraft&&first.kind==='reject'&&first.createDraft&&!out.actions.length&&!out.hold)out={...out,createDraft:first.createDraft}
  // notte 22/10 (n-lungo-motivato): «da domani la carbonara costa 13» → il server non programma e il modello chiede «Lo cambio subito?»:
  // le azioni capite (valide) restano in attesa con la domanda, così il «sì» le applica (prima la domanda partiva senza azioni).
  if(out.kind==='ask'&&!out.actions.length&&!out.hold&&first.kind==='reject'&&first.actions.length&&first.reason.startsWith(reasonText(['data_futura'])))out={...out,ids:[],actions:first.actions} // niente elenco numerato sotto un sì/no
  // notte 22/10 (n-dialetto): il server aveva costruito le parti chiare in attesa + la domanda «quale?» (hold) e il modello ha risposto con
  // una domanda sua senza azioni: la parte chiara («e la gricia pure») restava persa. Il sospeso del server resta, con la domanda del modello.
  if(out.kind==='ask'&&!out.actions.length&&!out.hold&&!out.twins?.length&&first.kind==='reject'&&first.hold&&first.hold.actions.length)out={...out,actions:first.hold.actions,hold:first.hold}
  // R9: domanda nata da piatti con lo stesso nome (piatto_doppio): i candidati sono SOLO i gemelli veri, le parti chiare della
  // richiesta restano in attesa con la domanda (il modello le rivede col messaggio dopo).
  if(out.kind==='ask'&&!out.hold&&first.kind==='reject'&&first.twins?.length)out={...out,ids:first.twins.map(t=>t.id),actions:first.actions,twins:first.twins}}
 // R9: una domanda ancora aperta non si rimanda uguale. Se il modello ripete la domanda in sospeso (o dice «c'è già» di un piatto con
 // un nome diverso), il server non la manda: auto-correzione col motivo («il titolare ha già risposto: …»), poi una domanda diversa
 // con le opzioni numerate scritta dal modello. Al massimo 3 chiamate per turno; se anche l'ultima ripete, solo i fatti.
 const pendTwins:Twin[]=pend?.kind==='ask'?pend.ask.twins??[]:[]
 // La domanda di prima: quella in sospeso, oppure la prima parte dell'ultima risposta se era una domanda (invariante: mai due volte di fila).
 const lastQ=(()=>{const b=(run.lastBot??'').replace(/^Sono l.*?persona\.\s*/s,'').split(/\n\n/)[0]!.trim();return /\?\s*$|\brispondi\b/i.test(b)?b:''})()
 // Solo su un sospeso con un'operazione dentro (piatti con lo stesso nome / parti chiare in attesa, parti incerte): è il caso del bug.
 const substance=pend?.kind==='ask'?!!(pend.ask.twins?.length||pend.ask.actions?.length):pend?.kind==='hold'
 const prevQ=substance||engine==='haiku'?(pend?.kind==='ask'?pend.ask.question:'')||lastQ:''
 type Run=NonNullable<Awaited<ReturnType<typeof brainPlan>>>
 const draftQ=(r:Run)=>cleanDraft(r.decision.draft,{wrote:false,numbers:numbersOK(r,refs.map(x=>x.price))})??''
 // «C'è già "pasta al pesto"» quando nel menu c'è solo «Pasta al pesto e lasagna»: un nome contenuto in un altro non è un doppione.
 const falseTwin=(o:Outcome,r:Run)=>{if(o.kind!=='ask')return false;const tw=[...(o.twins??[]),...pendTwins];if(!tw.length&&!(engine==='haiku'&&o.actions.some(a=>a.kind==='create')))return false;const q=' '+plain(draftQ(r))+' ';if(!/ (?:c e gia|esiste gia|ce l abbiamo gia|e gia nel menu|ci sono gia|sono gia) /.test(q))return false
  const fresh=[...(o.actions??[]),...(pend?.kind==='ask'?pend.ask.actions??[]:[])].flatMap(a=>a.kind==='create'&&!tw.some(t=>sameDishName(t.name,a.name))?[a.name]:[])
  return refs.some(x=>!tw.some(t=>t.id===x.id)&&q.includes(' '+plain(x.name)+' ')&&fresh.some(n=>(' '+plain(x.name)+' ').includes(' '+plain(n)+' ')))||fresh.some(n=>refs.some(x=>!sameDishName(x.name,n)&&(' '+plain(x.name)+' ').includes(' '+plain(n)+' '))&&draftQ(r).split(/[?.!\n]/).some(x=>{const y=' '+plain(x)+' ';return y.includes(' '+plain(n)+' ')&&/ (?:c e gia|esiste gia|ce l abbiamo gia|e gia nel menu|ci sono gia|sono gia) /.test(y)}))}
 const repeated=(o:Outcome,r:Run)=>(o.kind==='ask'||o.kind==='say'||o.kind==='read'||o.kind==='cancel')&&!!prevQ&&!!draftQ(r)&&(sameQuestion(draftQ(r),prevQ)||(!!lastQ&&sameQuestion(draftQ(r),lastQ)))
 // R10: una domanda che ignora ciò che il titolare ha già detto (sezione anche col nome pubblico, «tutti», piatto, prezzo) o che
 // non dice subito che una sezione nominata non c'è (con l'elenco) non si manda: auto-correzione col motivo, stesso tetto di chiamate.
 const askText=text+(pend?.kind==='ask'?' \n '+pend.ask.source:pend?.kind==='hold'?' \n '+String((pend.hold as any).source??''):'')
 const ignored=(o:Outcome,r:Run)=>o.kind==='ask'||o.kind==='say'?ignoredInQuestion(draftQ(r),{message:text,text:askText,sections,refs,lastQ,recent:r.ownerRecent??''}):null
 let noDraft=false
 // Banco prezzofisso 21/10 (pf-ambigua-04/05: «Ok, il Completo del Menu cena passa a 17 €.» senza nessuna scrittura): la bozza di un
 // piano di modifica (intent=change) racconta la modifica. Se il server non scrive, quella bozza non arriva mai al titolare come
 // risposta: resta solo se è una domanda. Vale per ogni esito senza scrittura (domanda, lettura, niente da fare).
 const actedDraft=(r:Run)=>draftOfUnappliedChange(r.decision.raw,r.decision.draft)
 for(let tries=0;(repeated(out,run)||falseTwin(out,run)||!!ignored(out,run))&&tries<2&&calls<3;tries++){if(budget.expired)return ''
  const ig=!repeated(out,run)&&!falseTwin(out,run)?ignored(out,run):null
  const why=ig?ig+': messaggio «'+text.slice(0,200)+'»':falseTwin(out,run)?reasonText(['doppio_falso']):reasonText([tries===0&&calls<2?'gia_risposto':'domanda_ripetuta'])+': «'+text.slice(0,200)+'» alla domanda «'+prevQ.slice(0,200)+'»'
  if(process.env.TAKO_BRAIN_DEBUG)void import('node:fs').then(fs=>fs.appendFileSync(String(process.env.TAKO_BRAIN_DEBUG),'R-RIPETUTA '+JSON.stringify({text,why})+'\n')).catch(()=>{})
  const before:Outcome=out,r3=await brainPlan(db,{...base,correction:{previous:run.decision.content??'',reason:why}});calls++;if(budget.expired)return '';if(!r3)return down()
  const o3=decide(r3);run=r3
  if(o3.kind==='reject'||(needsText(o3,r3)&&!(o3.kind==='change'&&approval(o3.actions,refs,text,answered))))out=before.kind==='ask'?{...before}:{kind:'ask',ids:[],actions:[]}
  else out=o3.kind==='ask'&&before.kind==='ask'?{...o3,ids:o3.ids.length?o3.ids.filter(id=>!before.twins?.length||before.twins.some((t:Twin)=>t.id===id)):before.ids,actions:o3.actions.length?o3.actions:before.actions,...(before.twins?{twins:before.twins}:{})}:o3}
 // Sezione inesistente non detta dal modello: la sua domanda resta e il server aggiunge il fatto con l'elenco delle sezioni.
 const igLast=!repeated(out,run)&&!falseTwin(out,run)?ignored(out,run):null,unknownOnly=!!igLast&&igLast.startsWith('nel menu non c\u2019è una sezione')
 if(repeated(out,run)||falseTwin(out,run)||(!!igLast&&!unknownOnly))noDraft=true
 const sectionTurn=namedSections(askText,sections).ids.length>0
 // R10: sezione nominata che non c'è e nessuna domanda utilizzabile: il fatto è l'elenco delle sezioni del menu (riletto).
 const missingSection=(noDraft||unknownOnly)&&!!unknownSectionPhrase(text,sections)&&!namedSections(text,sections).ids.length?'Sezioni del menu: '+sectionListText(sections):''
 // La domanda che resta aperta sullo stesso sospeso porta con sé la richiesta originale (gemelli e parti chiare).
 if(out.kind==='ask'&&!out.hold&&pendTwins.length&&!out.twins?.length)out={...out,ids:pendTwins.map(t=>t.id),actions:out.actions.length?out.actions:pend!.kind==='ask'?pend!.ask.actions:[],twins:pendTwins}
 // ── Prova dal vivo 21/10 sera: dopo il modello, vincoli del server sui comandi che il modello non chiudeva ─────────────────────
 // (a) «aggiungi X nel menu pranzo»: il Menu nominato vince su un piatto simile di un altro Menu; senza un sottomenu adatto il server
 //     propone il nome (portata del piatto) e al «sì» crea sottomenu e piatto. (b) «tutte le paste a 9», «aumenta tutti i primi di 1
 //     euro»: comando sul gruppo intero (solo piatti con prezzo, mai Menu fissi), una domanda sola se il gruppo è in più Menu.
 // (c) «solo i visibili»: nessuna azione sui piatti nascosti.
 let follow:Follow|null=pre?.follow??null,serverQ:string|null=null,sessOut:SessState|null=sessNow
 if(engine==='haiku'&&sessNow&&!pre){const notes=(run.decision.notes??[]).filter((n:string)=>n.startsWith('sostituzione:')),acts=out.kind==='change'?out.actions:[]
  if(out.kind==='change'&&notes.length&&acts.every(a=>(a as any).fromReplace)){const s2:SessState={...sessNow,done:{...sessNow.done},kept:[...sessNow.kept],acts:[...sessNow.acts]}
   const secOf=(a:MenuAction)=>a.kind==='create'?a.sectionId:'id' in a?refs.find(r=>r.id===(a as any).id)?.sectionId??'':''
   for(const n of notes){const [,id,names]=n.split(':') as [string,string,string];s2.done[id]=(names??'').split(';').filter(Boolean);s2.kept=s2.kept.filter(k=>k!==id);s2.acts=[...s2.acts.filter(a=>secOf(a)!==id),...acts.filter(a=>secOf(a)===id)]}
   sessOut=s2
   if(!sessionMissing(s2,sections).length)out={kind:'change',actions:s2.acts}
   else{const dq=cleanDraft(run.decision.draft,{wrote:false,numbers:numbersOK(run)})??'';out={kind:'ask',ids:[],actions:[]};serverQ=/\?/.test(dq)&&!/\b(?:fatto|ho (?:messo|aggiornato|sostituito))\b/i.test(dq)?dq:sessionAsk(s2,sections)}}}
 // notte 22/10 (QA v145 «quanto costa il riso giallo?» → «alzalo di un euro» → «Intendi il riso giallo a 8 €? Dimmi se è lui.»): il MODELLO
 // chiede conferma sul piatto unico appena citato dal bot. Pronome singolare + un solo piatto nell'ultima risposta del bot + un valore
 // leggibile (differenza, prezzo, finito, nascondi, rimetti) = l'azione su quel piatto, senza domanda. Vale per qualsiasi verbo col pronome.
 // notte 22/10 (cieco «abbassa la cacio e pepe di trenta centesimi» → «Intendi il Supplì cacio e pepe o la Cacio e pepe?»): anche un piatto
 // nominato ESATTAMENTE (nome intero, unico) mentre l'altro candidato ha solo una parte del nome: vale quello detto.
 const exactOne=(()=>{const t=' '+plain(text).replace(/\b(?:il|lo|la|i|gli|le|l)\s+/g,' ')+' ',ex=refs.filter(r=>{const n=plain(r.name).replace(/^(?:il|lo|la|i|gli|le|l)\s+/,'');return n.length>=4&&t.includes(' '+n+' ')});const top=ex.filter(r=>!ex.some(o=>o.id!==r.id&&plain(o.name).includes(plain(r.name))));return top.length===1?top[0]!:null})()
 const exIn=(id:string)=>out.kind==='ask'&&(out.ids.includes(id)||(!out.ids.length&&(' '+plain(String(run.decision.draft??''))+' ').includes(' '+plain(refs.find(r=>r.id===id)?.name??'\u0000')+' ')))
 if(engine==='haiku'&&!pre&&!sessNow&&out.kind==='ask'&&!out.twins?.length&&(!out.actions.length||!!pend||out.actions.every(a=>'id' in a&&a.kind!=='delete'))&&(!pend||pend.kind==='ask'||pend.kind==='hold')){const lb=' '+plain(run.lastBot??'')+' ',named0=refs.filter(r=>plain(r.name).length>=3&&lb.includes(' '+plain(r.name)+' ')),named=named0.filter(r=>!named0.some(o=>o.id!==r.id&&plain(o.name).includes(plain(r.name))))
  const dq=' '+plain(String(run.decision.draft??''))+' ',draftDishes=refs.filter(r=>plain(r.name).length>=3&&dq.includes(' '+plain(r.name)+' '))
  // A: pronome + piatto unico dell'ultima risposta del bot (nessun altro piatto detto). B: nome esatto unico + domanda del modello «quale piatto?» (≥2 piatti).
  const A=(ONE_PRONOUN.test(plain(text))||/^(?:e |ok |allora |ah )?(?:(?:e|è|sono|so|e gia) )?(?:finit\w*|esaurit\w*|tornat\w*|disponibil\w*|non c e piu)$/.test(plain(text)))&&named.length===1&&!/\b(?:prima|precedente|altr[oaie])\b/.test(plain(text))&&!/\*eliminato\*/i.test(run.lastBot??'')&&!refs.some(r=>r.id!==named[0]!.id&&g9DishMentioned(r.name,text,refs))?named[0]!:null
  const B=!A&&exactOne&&exIn(exactOne.id)&&draftDishes.length>=2&&draftDishes.some(r=>r.id===exactOne.id)?exactOne:null
  // C (QA v145 «alza il pesto di un euro» → «quale?» → «la pasta al pesto dei primi»): risposta che nomina ESATTAMENTE uno dei candidati
  // della domanda in sospeso → l'azione della richiesta originale su quel piatto.
  const pendIds:string[]=pend?.kind==='ask'?(pend.ask.ids??[]):pend?.kind==='hold'?((pend.hold.asks??(pend.hold.ask?[pend.hold.ask]:[])) as any[]).flatMap(a=>a.type==='choose'&&Array.isArray(a.options)?a.options:[]):[]
  // D (qa-continua «il riso giallo a 9» → il modello sbaglia piatto/prezzo e chiede): comando semplice «<piatto detto per intero> a <prezzo>».
  const D=!A&&!B&&exactOne&&/^(?:ok |allora |e )?(?:il |lo |la |l |i |gli |le )?$/.test((' '+plain(text)+' ').replace(' '+plain(exactOne.name).replace(/^(?:il|lo|la|i|gli|le|l)\s+/,'')+' ',' ').replace(/\s+(?:a|costa|passa a|lo metti a|mettila a|mettilo a)\s+\d+(?:\s+\d{1,2})?(?:\s+euro)?\s*$/,'').trim()+' ')&&/\b(?:a|costa)\s+\d/.test(plain(text))?exactOne:null
  const C=!A&&!B&&!D&&exactOne&&pendIds.length>=2&&pendIds.includes(exactOne.id)?exactOne:null,one=A??B??C??D
  const vtext=C?(pend?.kind==='ask'?askOrigin(pend.ask):String((pend as any)?.hold?.source??''))+' \n '+text:text
  const p2=plain(vtext),verbs=(p2.match(/\b(?:alz|abbass|aument|diminu|scont|mett|port|togli|nascond|lev|segn|rimett|evidenz|aggiung|elimin|cancell|sposta|rinomin)\w*/g)??[]).length
  if(one&&!(fixedSecIds.has(one.sectionId??'')&&!/\b(?:finit|esaurit|tornat|disponibil|nascond|togli|lev[ai]|rimett)\w*/.test(plain(text)))&&verbs<=1&&!/\b(?:e poi|poi|anche|evidenz\w*|promo|per ?cento|aggiung\w*|nuov[oa]|locale|ristorante)\b|%/.test(p2+' '+vtext)){
   const act=pronounAct(one,vtext)
   if(act&&(act.kind!=='price'||((act as any).price>0&&!oddPrice(act,refs)))){out={kind:'change',actions:[act]};noDraft=true;(run.decision as any).draft=''}}}
 // notte 22/10 fase 3 (memoria a breve; QA v149 «il riso giallo a 9» → «anzi rimettilo a 8» → «Intendi *pasta al pesto*…?»): il pronome
 // singolare senza un piatto detto vale per il piatto UNICO dell'ultima risposta del bot (lettura o scrittura), mai per un piatto di
 // scambi più vecchi. Se il modello scrive su un altro piatto, il server riporta l'azione sul piatto dell'ultima risposta.
 if(engine==='haiku'&&!pre&&!sessNow&&out.kind==='change'&&out.actions.length===1&&'id' in out.actions[0]!&&(!pend||pend.kind==='ask')){const lb=' '+plain(run.lastBot??'')+' ',n0=refs.filter(r=>plain(r.name).length>=3&&lb.includes(' '+plain(r.name)+' ')),nm1=n0.filter(r=>!n0.some(o=>o.id!==r.id&&plain(o.name).includes(plain(r.name))))
  const pt=plain(text),a0=out.actions[0] as any
  if(nm1.length===1&&a0.id!==nm1[0]!.id&&(ONE_PRONOUN.test(pt)||/^(?:anzi |no |ok |e )?(?:(?:e|è|sono|so) )?(?:finit\w*|esaurit\w*|tornat\w*)$/.test(pt))&&!/\b(?:prima|precedente|altr[oaie])\b/.test(pt)&&!/\b(?:e poi|poi|anche|evidenz\w*|promo|per ?cento|aggiung\w*|nuov[oa]|locale|ristorante|tutt[ieoa])\b|%/.test(pt)&&(pt.match(/\b(?:alz|abbass|aument|diminu|scont|mett|port|togli|nascond|lev|segn|rimett|evidenz|aggiung|elimin|cancell|sposta|rinomin)\w*/g)??[]).length<=1&&!/\*eliminato\*/i.test(run.lastBot??'')&&!refs.some(r=>g9DishMentioned(r.name,text,refs))){const act=pronounAct(nm1[0]!,text)
   if(act&&act.kind===a0.kind&&(act.kind!=='price'||((act as any).price>0&&!oddPrice(act,refs)))){out={kind:'change',actions:[act]};noDraft=true;(run.decision as any).draft=''}}}
 // fase 3 (QA v149 «aggiungi patatine fritte a 4» → creato nei *Piatti di prova* → «nei Primi del Menu di verifica» → «Cosa vuoi fare nei
 // Primi?»): subito dopo «Nuovo piatto *X* in *S*», un messaggio che dice solo un altro sottomenu è la correzione di quella creazione: sposta X.
 if(engine==='haiku'&&!pre&&!sessNow&&!pend&&out.kind!=='change'&&out.kind!=='undo'&&out.kind!=='cancel'){const mm=(run.lastBot??'').match(/Nuovo piatto \*([^*\n]+)\* in \*([^*\n]+)\*/),pt=plain(text)
  if(mm&&!/\d/.test(pt)&&pt.split(' ').length<=10&&/^(?:(?:no|anzi|ma|scusa|ok|volevo dire|intendevo)\s+)*(?:(?:mettil[oaie]|spostal[oaie]|mettel[oaie])\s+)?(?:nei|negli|nelle|nel|nella|in|tra i|tra le|ai|agli|alle|al|alla)\b/.test(pt)){
   const it=refs.find(r=>sameDishName(r.name,mm[1]!)),nmM=namedMenus(text,base.menus),secOk=(id:string)=>{const x=sections.find(z=>z.id===id),m=x?base.menus.find(q=>q.name===x.menu):undefined;return !!m&&m.active!==false&&(m.secs as any[]).find(z=>z.id===id)?.active!==false}
   let ns=namedSections(text,sections).ids.filter(id=>!fixedSecIds.has(id));if(nmM.length)ns=ns.filter(id=>nmM.some(m=>m.name===sections.find(z=>z.id===id)?.menu));else if(ns.length>1){const v=ns.filter(secOk);if(v.length)ns=v}
   if(it&&ns.length===1&&ns[0]!==it.sectionId){out={kind:'change',actions:[{kind:'move',id:it.id,sectionId:ns[0]!} as MenuAction]};noDraft=true;(run.decision as any).draft=''}}}
 // fase 3 (qa-continua live «il riso giallo a 9 e la pasta carbonara a 10» → «Per la pasta carbonara a 10 € confermo subito?» senza motivo):
 // 1–3 prezzi chiari, ognuno su un piatto nominato per intero, con cifre e senza dubbi = si scrive (la domanda del modello non parte).
 if(engine==='haiku'&&!pre&&!sessNow&&!pend&&out.kind==='ask'&&!out.twins?.length&&!/\?/.test(text)&&!/\b(?:se|forse|domani|dopodomani|settimana|stasera|lunedi|martedi|mercoledi|giovedi|venerdi|sabato|domenica|dal|dalla|tutt[ieoa]|non|anzi|prima)\b/.test(plain(text))){const cc=clearChanges(text,refs)
  if(cc&&cc.length>=1&&cc.length<=3&&new Set(cc.map(a=>(a as any).id)).size===cc.length&&cc.every(a=>{if(a.kind!=='price')return false;const r=refs.find(x=>x.id===a.id);return !!r&&!r.hidden&&!fixedSecIds.has(r.sectionId??'')&&fullyNamed(r.name,text)&&a.price>0&&!oddPrice(a,refs)&&new RegExp('\\b'+String(a.price).replace('.','[.,]')+'\\b').test(text)})){out={kind:'change',actions:cc};noDraft=true;(run.decision as any).draft=''}}
 // fase 3 (qa-continua «aggiungi le trofie al pesto a 11 nei primi» → «Nei Primi di quale Menu: Menu di verifica o Menu cena?» con i Primi
 // della cena VUOTI e nascosti): nome + prezzo + un sottomenu detto che, tra quelli visibili con piatti (del Menu detto, se c'è), è uno solo
 // = il piatto nuovo si crea lì (la domanda del modello non parte).
 if(engine==='haiku'&&!pre&&!sessNow&&!pend&&out.kind==='ask'&&out.actions.every(a=>a.kind==='create')&&(!out.hold||out.hold.actions.every(a=>a.kind==='create'))&&!out.twins?.length&&startsWithCreate(text)&&!/\b(?:e poi|poi|anche|pure)\b/.test(plain(text))&&!/[,;\n]/.test(text)&&(text.match(/\d+(?:[.,]\d+)?/g)??[]).length===1){const nmM=namedMenus(text,base.menus)
  const liveS=sections.filter(x=>{const m=base.menus.find(q=>q.name===x.menu),i=m?(m.secs as any[]).find(z=>z.id===x.id):undefined;return !fixedSecIds.has(x.id)&&!!m&&m.active!==false&&i?.active!==false&&(i?.items??0)>0&&(!nmM.length||nmM.some(q=>q.name===x.menu))})
  const said=namedSections(text,liveS).ids,pc=said.length===1?parseCreate(text,liveS):null
  if(pc&&pc.name&&!/\d/.test(pc.name)&&!/\b(?:e|euro|ed)\b/.test(plain(pc.name))&&pc.price!=null&&pc.price>0&&pc.sectionId===said[0]&&!pc.unknownSection&&!refs.some(r=>sameDishName(r.name,pc.name!))){const nm=pc.name.replace(/^(?:il|lo|la|i|gli|le|l)\s+/i,'').trim();out={kind:'change',actions:[{kind:'create',sectionId:said[0]!,name:nm.charAt(0).toLocaleUpperCase('it')+nm.slice(1),price:pc.price,description:null} as MenuAction]};noDraft=true;(run.decision as any).draft=''}}
 // notte 22/10 (cieco b1 «le frittatine so finite tutte e due», «spritz 6,5 tutti e due»): «tutti e due / entrambi» con ESATTAMENTE due
 // candidati = l'azione su entrambi (prima una domanda inutile). L'azione la legge il server (finito / nascondi / un prezzo detto).
 if(engine==='haiku'&&!pre&&!sessNow&&out.kind==='ask'&&!out.hold&&!out.twins?.length&&/\b(?:tutt[ie] e (?:due|2)|entramb[ie]|ambedue)\b/.test(plain(text))){const lb2=' '+plain(run.lastBot??'')+' ',bot2=refs.filter(r=>plain(r.name).length>=3&&lb2.includes(' '+plain(r.name)+' ')&&!refs.some(o=>o.id!==r.id&&plain(o.name).includes(plain(r.name))&&lb2.includes(' '+plain(o.name)+' ')))
  // QA v145 («quanto costano il riso giallo e la pasta carbonara?» → «alzali tutti e due di 50 centesimi»): i due piatti della risposta di prima.
  const ids0=[...new Set(out.ids)].filter(id=>refs.some(r=>r.id===id)),ids2=bot2.length===2&&!refs.some(r=>g9DishMentioned(r.name,text,refs))?bot2.map(r=>r.id):ids0
  if(ids2.length===2){const p2=plain(text),sp=singlePrice(text),fin=/\b(?:finit\w*|esaurit\w*|terminat\w*|fernut\w*)\b/.test(p2)&&!/\b(?:non|nun)\s+(?:e|sono|so)?\s*finit/.test(p2),hide=/\b(?:nascond\w*|togli\w*|lev[ai]\w*)\b/.test(p2)
   const rd2=relativeDelta(text),acts=fin?ids2.map(id=>({kind:'available',id,value:false}) as MenuAction):hide?ids2.map(id=>({kind:'hidden',id,value:true}) as MenuAction):rd2?ids2.flatMap(id=>{const r=refs.find(x=>x.id===id)!;const v=Math.round((r.price+rd2.delta)*100)/100;return r.price>0&&v>0?[{kind:'price',id,price:v} as MenuAction]:[]}):sp!==null&&sp>0&&/\d/.test(text)&&!/\b(?:alz|abbass|aument|diminu|scont)\w*/.test(p2)?ids2.map(id=>({kind:'price',id,price:sp}) as MenuAction):[]
   if(acts.length){out={kind:'change',actions:acts};noDraft=true;(run.decision as any).draft=''}}}
 if(engine==='haiku'&&!pre&&!sessNow){
  const p0=plain(text),wantAdd=/\b(?:aggiung\w*|inserisc\w*|nuov[oa]|metti(?:mi|ci)?)\b/.test(p0)&&!/\b(?:togli\w*|tolg\w*|lev[ai]\w*|elimin\w*|cancell\w*|rimuov\w*|posto|invece|cambi\w*|sostitu\w*)\b/.test(p0) // 28/10 sera (audit): «togli X dal menu alla carta e metti Y» creava X
  const named=namedMenus(text,base.menus).filter(m=>m.pricing!=='fisso'),M=named.length===1?named[0]!:null
  const onePrice=singlePrice(text)
  const mSecs=M?sections.filter(x=>x.menu===M.name):[]
  if(M&&wantAdd&&!namedSections(text,mSecs).ids.length){
   const creates=out.kind==='change'?out.actions.filter(a=>a.kind==='create') as Extract<MenuAction,{kind:'create'}>[]:[]
   // Sottomenu non adatto: portata diversa da quella del piatto, o un sottomenu-formula («Completo») — il titolare non l'ha nominato.
   const unfit=(secId:string,dish:string)=>{const sc=mSecs.find(x=>x.id===secId);if(!sc)return true;const dc=dishCourse(dish);if(!dc||suitableSection(M.name,dish,sections)?.id===sc.id)return false
    const r=courseRank(sc.name);return r>0?r!==courseRank(dc):/\b(?:complet\w*|formul\w*|fiss\w*|degustazion\w*|del giorno|menu)\b/.test(plain(sc.name))}
   const okInM=creates.length>0&&creates.every(a=>mSecs.some(x=>x.id===a.sectionId)&&!unfit(a.sectionId,a.name))
   const other=refs.filter(r=>r.menu!==M.name&&fullyNamed(r.name,text)&&!refs.some(x=>x.menu===M.name&&sameDishName(x.name,r.name)))
   const draftName=out.kind==='ask'&&out.createDraft?.name?out.createDraft.name:''
   const name0=creates.find(a=>!mSecs.some(x=>x.id===a.sectionId)||unfit(a.sectionId,a.name))?.name??(other.length===1?other[0]!.name:'')??''
   const name1=(name0||draftName).replace(/^(?:il|lo|la|i|gli|le|l)\s+/i,'').trim(),name=other.length===1&&name1&&fullyNamed(other[0]!.name,name1)?other[0]!.name:name1,nm=name?name.charAt(0).toLocaleUpperCase('it')+name.slice(1):''
   const touchesOther=out.kind!=='change'||out.actions.some(a=>'id' in a&&other.some(r=>r.id===(a as any).id))||creates.some(a=>!mSecs.some(x=>x.id===a.sectionId)||unfit(a.sectionId,a.name))
   if(nm&&!okInM&&touchesOther&&(other.length||draftName||creates.length)){
    const price=creates.find(a=>a.price>0)?.price??(out.kind==='ask'&&out.createDraft?.price?out.createDraft.price:null)??onePrice
    const sec=suitableSection(M.name,nm,sections)??(mSecs.length===1&&!dishCourse(nm)&&!unfit(mSecs[0]!.id,nm)?mSecs[0]!:null)
    const mLabel=/^men[uù]\b/i.test(M.name.trim())?'*'+safe(M.name)+'*':'Menu *'+safe(M.name)+'*'
    if(sec&&price!=null&&price>0)out={kind:'change',actions:[{kind:'create',sectionId:sec.id,name:nm,price,description:null} as MenuAction]}
    else if(sec){out={kind:'ask',ids:[],actions:[],createDraft:{name:nm,price:null,sectionId:sec.id,sectionName:null}};serverQ='A che prezzo metto *'+safe(nm)+'* nei *'+safe(sec.name)+'* del '+mLabel+'?'}
    else{const course=dishCourse(nm);if(course){const cs={kind:'create_section',newSectionId:randomUUID(),name:course,menuId:M.id,menuName:M.name,hidden:false} as MenuAction
     out={kind:'ask',ids:[],actions:[cs],createDraft:{name:nm,price:price!=null&&price>0?price:null,sectionId:null,sectionName:course}}
     serverQ='Nel '+mLabel+' non c’è un sottomenu adatto a *'+safe(nm)+'*: creo il sottomenu *'+course+'* e '+(()=>{const w=plain(nm).split(' ')[0]!;return /e$/.test(w)?'le':/i$/.test(w)?'li':/a$/.test(w)?'la':'lo'})()+' metto lì'+(price!=null&&price>0?' a *'+price.toFixed(2).replace('.',',')+' €*':'')+'? Rispondi *sì* oppure dimmi il nome del sottomenu.'+(price!=null&&price>0?'':' Dimmi anche il prezzo.')}}}}
  // notte 22/10 (n-gruppo-pizze-due-menu): «alza le pizze di 1 euro» = il sottomenu intero: lo legge il server anche se il modello ha
  // proposto un elenco suo (prendeva pizze di due Menu e chiedeva dell’ultima); se il sottomenu è in più Menu, chiede quale.
  // notte 22/10 (n-gruppo-pizze-due-menu): risposta alla domanda del server «Le Pizze ci sono in più Menu: in quale?» → il comando di
  // gruppo di prima si applica nel Menu detto (prima il modello rifaceva un riepilogo da confermare con OK).
  {const src=pend?.kind==='ask'&&/ci sono in più Menu: in quale\?/.test(pend.ask.question??'')&&typeof pend.ask.source==='string'?pend.ask.source:'',nm=src?namedMenus(text,base.menus):[]
   if(src&&nm.length===1&&!CMD_RE_NEW.test(p0)){const g=seraGroup(src+' nel menu '+nm[0]!.name,refs,sections,fixedSecIds,{menus:base.menus});if(g&&'actions' in g){out={kind:'change',actions:g.actions};answered=true}}
   // notte 22/10 (cieco b1 «tutti e due» → riepilogo → «ok» ignorato): «tutti e due / entrambi / tutti / in tutti» = il gruppo in ogni Menu della domanda.
   else if(src&&!CMD_RE_NEW.test(p0)&&/^(?:in |a |nei |su )?(?:tutti e due|tutte e due|entramb\w*|tutti|tutte|ambedue|in tutti e due|tutti e 2|tutti i menu|in entrambi)(?: i menu)?$/.test(p0)){const g0=seraGroup(src,refs,sections,fixedSecIds,{menus:base.menus})
    if(g0&&'ask' in g0){const acts=g0.menus.flatMap(mn=>{const g=seraGroup(src+' nel menu '+mn,refs,sections,fixedSecIds,{menus:base.menus});return g&&'actions' in g?g.actions:[]});if(acts.length){out={kind:'change',actions:acts};noDraft=true}}}}
  const secWord=engine==='haiku'&&out.kind!=='cancel'&&out.kind!=='undo'&&!pend?sectionGroupWord(p0,sections,refs):null
   if((out.kind!=='change'||!!secWord)&&(/\btutt[ieoa]\b/.test(p0)||/\b(?:solo quell[ie]|alzal[ie]|abbassal[ie]|aumental[ie]|diminuiscil[ie]|portal[ie]|mettil[ie])\b/.test(p0)||!!sectionGroupWord(p0,sections,refs))&&(clearCommand(text)||/\d|\bzero\b/.test(p0))){const g=seraGroup(text,refs,sections,fixedSecIds,{menus:base.menus})
   // notte 22/10 (QA v141 «metti tutti i primi a zero»: «Quali Primi, del Menu di verifica o del Menu cena?» con i Primi della cena VUOTI):
   // il gruppo lo legge il server (solo sottomenu con piatti con prezzo); la domanda del modello non parte.
   if(g&&'actions' in g){out={kind:'change',actions:g.actions};noDraft=true}
   else if(g&&'ask' in g){out={kind:'ask',ids:[],actions:[]};serverQ=(/e$/i.test(g.label.trim())?'Le':'I')+' *'+safe(g.label)+'* ci sono in più Menu: in quale? '+g.menus.map(x=>'*'+safe(x)+'*').join(' o ')+'?'}}
  if(out.kind==='change'&&visibleOnly(text)){const keep=out.actions.filter(a=>!('id' in a)||a.kind==='hidden'||!refs.find(r=>r.id===(a as any).id)?.hidden);if(keep.length)out={...out,actions:keep}}}
 // notte 22/10 (qavero «aggiungi la frittatina» → «3,50» → creata nei Primi del Menu del giorno NASCOSTO): un piatto nuovo in un Menu o
 // sottomenu nascosto che il titolare non ha nominato non si crea: domanda col prezzo tenuto e l'elenco dei sottomenu visibili.
 if(engine==='haiku'&&pre?.why!=='regola'&&out.kind==='change'&&out.actions.length===1&&out.actions[0]!.kind==='create'&&!(out.actions[0] as any).fromReplace){const a=out.actions[0] as Extract<MenuAction,{kind:'create'}>,sc=sections.find(x=>x.id===a.sectionId),m=sc?base.menus.find(mm=>mm.name===sc.menu):undefined
  const hid=!!m&&(m.active===false||(m.secs as any[]).find(z=>z.id===sc!.id)?.active===false)
  // notte 22/10 (QA v145 GRAVE «aggiungi patatine fritte a 4» → creato nel sottomenu della conversazione PRIMA): il sottomenu di un piatto
  // nuovo vale solo se detto (messaggio o richiesta in sospeso) o se nel locale c'è un solo sottomenu visibile; mai ereditato dalla memoria.
  // fase 3: vale anche il sottomenu dell'ultima risposta se era la lettura di quel solo sottomenu («cosa c'è nei primi?» → «aggiungi…»).
  const readJustNow=(x:SectionRef)=>{const hs=[...String(run.lastBot??'').matchAll(/(?:^|\n)Nei \*([^*\n]+)\* del \*([^*\n]+)\*/g)];return hs.length===1&&hs[0]![1]===x.name&&hs[0]![2]===x.menu}
  const liveSecs=sections.filter(x=>!fixedSecIds.has(x.id)&&base.menus.some(mm=>mm.name===x.menu&&mm.active!==false&&(mm.secs as any[]).find(z=>z.id===x.id)?.active!==false))
  const unsaid=!!sc&&!pre&&liveSecs.length>1&&!namedSections(askText,sections).ids.includes(sc.id)&&!namedMenus(askText,base.menus).some(mm=>mm.name===sc.menu)&&!(pend?.kind==='ask'&&(pend.ask.draft?.sectionId===sc.id||(pend.ask.actions??[]).some((x:any)=>x.kind==='create'&&x.sectionId===sc.id)))&&!sessNow&&!readJustNow(sc)
  if(sc&&(hid&&!namedMenus(askText,base.menus).some(mm=>mm.name===sc.menu)||unsaid)){const info=(x:SectionRef)=>(base.menus.find(mm=>mm.name===x.menu)?.secs as any[]|undefined)?.find(z=>z.id===x.id),live=(x:SectionRef)=>!fixedSecIds.has(x.id)&&base.menus.some(mm=>mm.name===x.menu&&mm.active!==false)&&info(x)?.active!==false
   const msA=namedMenus(askText,base.menus).map(mm=>mm.name),inMsA=(arr:SectionRef[])=>{const f=msA.length===1?arr.filter(x=>x.menu===msA[0]):arr;return f.length?f:arr} // notte 22/10: con UN Menu detto, solo i suoi sottomenu
   const cands=inMsA(sections.some(x=>live(x)&&(info(x)?.items??0)>0)?sections.filter(x=>live(x)&&(info(x)?.items??0)>0):sections.filter(live)).slice(0,6) // fase 3: mai sottomenu vuoti in elenco
   const crs=dishCourse(a.name),fit1=crs?cands.filter(x=>sameSection(x.name,crs)):[]
   if(fit1.length===1&&a.price>0){const f1=fit1[0]!;out={kind:'ask',ids:[],actions:[{...a,sectionId:f1.id} as MenuAction],createDraft:{name:a.name,price:a.price,sectionId:null,sectionName:null}};serverQ='Metto *'+safe(a.name)+'* a *'+a.price.toFixed(2).replace('.',',')+' €* in *'+safe(f1.name)+'*'+(base.menus.length>1?' (Menu *'+safe(f1.menu.replace(/^men[uù]\s+/i,''))+'*)':'')+'? Rispondi *sì* oppure dimmi il sottomenu giusto.'}
   else{out={kind:'ask',ids:[],actions:[],createDraft:{name:a.name,price:a.price>0?a.price:null,sectionId:null,sectionName:null}};(out as any).secOptions=cands.map(x=>x.id)
   serverQ=(a.price>0?'Ok, *'+a.price.toFixed(2).replace('.',',')+' €*. ':'')+'In quale sottomenu metto *'+safe(a.name)+'*? Rispondi col numero o col nome.\n\n'+cands.map((x,i)=>(i+1)+'. *'+safe(x.name)+'* ('+safe(x.menu)+')').join('\n')}}}
 // notte 22/10 (QA v145 GRAVE «alzali tutti e due di 50 centesimi» → «a 50,00 €»): con una differenza detta («di 50 centesimi», «di un
 // euro») e nessun prezzo assoluto, ogni prezzo del piano è attuale ± differenza (il numero della differenza non è mai il prezzo).
 {const rdx=engine==='haiku'&&out.kind==='change'?relativeDelta(text):null
  if(rdx&&out.kind==='change'&&!/\b(?:a|costa|costano|metti\w*|porta\w*)\s+\d/.test(plain(text).replace(plain(rdx.text),' '))){let fixed=false
   const acts=out.actions.map(a=>{if(a.kind!=='price')return a;const r=refs.find(x=>x.id===a.id);if(!r||!(r.price>0))return a;const v=Math.round((r.price+rdx.delta)*100)/100;if(Math.abs(v-a.price)<0.005||v<=0)return a;fixed=true;return{...a,price:v} as MenuAction})
   if(fixed){out={...out,actions:acts};(run.decision as any).draft=''}}}
 if(serverQ)noDraft=true
 const finalRun=run
 // T6 (PIANO bot-haiku): menu o proposta cambiati mentre il modello pensava (dashboard, altro telefono) → con haiku si rilegge e si
 // rigioca il turno UNA volta; al secondo conflitto copy.menuChanged.
 let deleteConfirmed=false
 // run Haiku 21/10 (z-interruzioni-011/012): «Elimino *X*? Rispondi sì.» scritto dal modello come semplice domanda non lascia niente da
 // confermare e il «sì» girava a vuoto. Se la domanda nomina piatti del menu, diventa la proposta di eliminazione vera (serve sempre il sì).
 if(engine==='haiku'&&out.kind==='ask'&&!out.hold&&!out.twins?.length){const dq=String(finalRun.decision.draft??'');if(/\belimin\w*\b[^?]*\?/i.test(dq)&&/\brispondi\s+\*?s[iì]\b/i.test(dq)){const named=refs.filter(r=>plain(r.name).length>=3&&(' '+plain(dq)+' ').includes(' '+plain(r.name)+' '));if(named.length&&named.length<=8){out={kind:'change',actions:named.map(r=>({kind:'delete',id:r.id}) as MenuAction)};deleteConfirmed=pend?.kind==='batch'&&pend.why==='delete'&&/^(?:s[iì]|ok|va bene|confermo|certo)\b/i.test(plain(text))&&named.every(r=>(pend as any).actions.some((a:any)=>a.kind==='delete'&&a.id===r.id))}}}
 // run Haiku 21/10 (str-v-10): «Nascondo tutto il Menu *Cena*? Rispondi sì» scritto come domanda → proposta vera di nascondere quel
 // Menu/Sottomenu (con i piatti serve il sì: il «sì» dopo la conferma). Solo se il nome nella bozza è un Menu/Sottomenu del locale.
 if(engine==='haiku'&&out.kind==='ask'&&!out.hold&&!out.twins?.length){const dq=String(finalRun.decision.draft??''),pq=plain(dq);if(/\bnascond\w*\b[^?]*\?/i.test(dq)&&/\b(?:menu|sottomenu|tutt[oiae])\b/.test(pq)&&HIDE_WHOLE_MENU_Q.test(pq)){const w0=workspaceSchema.parse(row.draft) as any
   const menuHit=(w0.menus as any[]).filter(m=>{const k=plain(m.name).replace(/^menu /,'');return k.length>=3&&(' '+pq+' ').includes(' '+k+' ')})
   if(menuHit.length===1&&/\bmenu\b/.test(pq)){const m=menuHit[0];out={kind:'change',actions:[{kind:'set_menu_active',menuId:m.id,name:m.name,value:false,items:(m.sections as any[]).reduce((n:number,x:any)=>n+x.items.length,0)} as MenuAction]}}}}
 let conflict=false
 const result=await db.transaction(async tx=>{await lock(tx,ctx.phone)
  const live=await readBotWorkspace(ctx.tenant,tx);if(!live||!live.published||live.revision!==row.revision||live.revision!==live.published_revision){conflict=!!live?.published&&live.revision===live.published_revision;return copy.menuChanged}
  const pr2=(await tx.execute(sql`SELECT command,revision FROM tako_whatsapp_proposals WHERE phone=${ctx.phone} AND actor_id=${ctx.actor} AND restaurant_id=${ctx.tenant} AND expires_at>now() FOR UPDATE`))[0]
  if(JSON.stringify(pr2&&Number(pr2.revision)===row.revision?pr2.command:null)!==JSON.stringify(cmd)){conflict=true;return copy.menuChanged}
  const workspace=workspaceSchema.parse(live.draft),settings=(await tx.execute(sql`SELECT settings FROM restaurants WHERE id=${ctx.tenant}`))[0]?.settings as any
  const drop=()=>tx.execute(sql`DELETE FROM tako_whatsapp_proposals WHERE phone=${ctx.phone}`)
  // Prova dal vivo 21/10: le azioni davvero scritte in questo turno (la bozza del modello non può dire «esclusi» piatti cambiati).
  let wroteActs:MenuAction[]=[],lastRev=row.revision
  // R10: senza scrittura, mai la stessa domanda dell'ultima risposta (riepilogo rimandato uguale): restano i fatti.
  const groupNames=[...base.menus.map(m=>m.name),...sections.map(x=>x.name),...((out as any).actions??[]).flatMap((a:any)=>a.kind==='create_section'||a.kind==='create_menu'||a.kind==='rename_section'||a.kind==='rename_menu'?[String(a.name??'')]:[])]
  const say=(facts:string,wrote:boolean,extra:number[]=[])=>{let d=(noDraft||actedDraft(finalRun))&&!wrote?null:cleanDraft(finalRun.decision.draft,{wrote,numbers:numbersOK(finalRun,extra)});if(engine==='haiku')d=dropInventedGroups(d,groupNames,askText);if(d&&wrote&&engine==='haiku'){d=d.split(/(?<=[.!?])\s+/).filter(x=>!/\?\s*$/.test(x.trim())&&!/\b(?:rispondi|confermi|conferma)\b/i.test(x)).join(' ').trim()||null};if(d&&wrote&&engine==='haiku')d=finalRun.decision.notes?.includes('ripristino_come_spostamento')?null:pruneWroteDraft(d,wroteActs,refs);if(d&&!wrote&&facts&&lastQ&&sectionTurn&&sameQuestion(d,lastQ))d=null;if(d)d=noHiddenTalk(d,[...wroteActs,...(((out as any).actions??[]) as MenuAction[])]);return [d,facts].filter(Boolean).join('\n\n')||NOTHING}
  const pricesOf=(acts:MenuAction[])=>acts.flatMap(a=>'price' in a&&typeof (a as any).price==='number'?[(a as any).price as number]:[]).concat(acts.flatMap(a=>'id' in a?[refs.find(r=>r.id===(a as any).id)?.price??-1]:[]))
  // Scrive e pubblica, poi rilegge dal DB: i fatti della risposta sono quelli riletti.
  const applyNow=async(effective:MenuAction[],label:[string,string]=['WhatsApp: aggiornamento automatico','WhatsApp: pubblicazione automatica']):Promise<{facts:string,allOk:boolean,revision:number,inherited:string}>=>{
   // 28/10 sera (prova dal vivo: «aggiungi tiramisù nei dolci alla carta» → «Tiramisù alla carta»): il nome del Menu in coda al nome di un
   // piatto nuovo non fa parte del nome, da qualunque percorso arrivi l'azione
   effective=effective.map(a=>a.kind==='create'?{...a,name:stripMenuSuffix((a as any).name,sections)??(a as any).name} as MenuAction:a)

   wroteActs=[...wroteActs,...effective]
   const beforeW=structuredClone(workspace);applyActions(workspace,effective,{uploads:new Map(),timezone:String(settings?.timezone??'Europe/Rome')});const next=workspaceSchema.parse(workspace)
   const inh=inheritPhotos(beforeW,next);if(!beginWrite(budget))throw new Error('WhatsApp turn expired');const saved=await applyBotChange(ctx.tenant,ctx.actor,[label[0],label[1]],{expectedPublishedRevision:live.revision,next},tx as unknown as DB);if(budget.expired)throw new Error('WhatsApp turn expired')
   const waItems=new Map(beforeW.menus.flatMap((m:any)=>m.sections.flatMap((sec:any)=>sec.items.map((i:any)=>[i.id,structuredClone(i)] as const)))),back=undoFor(effective,id=>waItems.get(id) as any)
   await drop();await rememberRenames(tx,ctx.tenant,effective,refs,settings);await writeLast(tx,ctx.phone,back?{kind:'last',actions:effective,undo:back,revision:saved.revision+1,at:Date.now()}:null);const rec=undoRecordFor(beforeW,next);await writeUndo(tx,ctx.phone,rec);await trackChange(tx,ctx.phone,rec)
   // notte 22/10 (cc-giornata-05): i piatti eliminati restano 30 minuti tra i «ripristinabili» (nome, prezzo, sottomenu di prima).
   {const dels=effective.filter(a=>a.kind==='delete'&&waItems.has((a as any).id)).map(a=>({id:(a as any).id as string,before:waItems.get((a as any).id),sectionId:refs.find(r=>r.id===(a as any).id)?.sectionId??undefined}));if(dels.length)await trackChange(tx,ctx.phone,{at:Date.now(),items:dels} as any)}
   const reread=await readBotWorkspace(ctx.tenant,tx),after=reread?.published?catalogOf(workspaceSchema.parse(reread.published)):catalogOf(next),{ok,failed}=verifyApplied(effective,after.refs)
   inBackground(learnAfter(db,{tenant:ctx.tenant,refs,sections,run:finalRun,applied:ok.length>0,key,meter:ai.meter,engine}))
   const facts=[ok.length?changeFacts(ok,refs,sections):'',failed.length?unsavedText(failed.map(a=>describeAction(a,refs,sections))):'',out.kind==='change'&&out.after&&out.after.type==='read'&&!(effective.some(a=>a.kind==='create')&&((out.after as any).ids??[]).some((id:string)=>!effective.some(e=>'id' in e&&(e as any).id===id)))?planText(out.after,after.refs,after.sections):'',inheritedNote(inh)].filter(Boolean).join('\n\n')
   lastRev=reread?.revision??saved.revision+1
   return{facts,allOk:!failed.length,revision:reread?.revision??saved.revision+1,inherited:inheritedNote(inh)}}
  const publish=async(actions:MenuAction[]):Promise<string>=>{actions=noHide(actions);let effective=effectiveMenuActions(actions,workspace)
   // notte 22/10 (cieco b2 «nascondi tutti i dolci» → nascosti piatto per piatto, due frasi uguali): «tutti i <sottomenu>» nascosto per
   // intero = il sottomenu nascosto (un interruttore, si rimette con «rendi visibile»), con UNA domanda del server.
   let wholeSec:{name:string,menu:string,items:number}|null=null
   if(engine==='haiku'&&pre?.why!=='regola'&&/\btutt[ieoa]\b/.test(plain(text))&&effective.length>=2&&effective.every(a=>a.kind==='hidden'&&a.value)){const secs=[...new Set(effective.map(a=>refs.find(r=>r.id===(a as any).id)?.sectionId??''))]
    if(secs.length===1&&secs[0]){const sid=secs[0]!,items=refs.filter(r=>r.sectionId===sid),sc=sections.find(x=>x.id===sid);if(sc&&items.every(r=>r.hidden||effective.some(a=>(a as any).id===r.id))){effective=[{kind:'set_section_active',sectionId:sid,name:sc.name,menuName:sc.menu,value:false,items:items.length} as MenuAction];wholeSec={name:sc.name,menu:sc.menu,items:items.length}}}}
   // T4b (1): niente da cambiare → nessuna scrittura, si dice com'è già (fatti del menu).
   const already=engine==='haiku'?noopFacts(actions,effective,refs):''
   if(!effective.length){await drop();const rs=actions.filter(a=>a.kind==='rename_section'||a.kind==='rename_menu') as any[];if(engine==='haiku'&&rs.length&&rs.length===actions.length)return rs.map(a=>(a.kind==='rename_menu'?'Il Menu *':'Il sottomenu *')+safe(a.name)+'* si chiama già così.').join('\n');return say(already||copy.noChanges,false)}
   {const problem=salesActionProblem(effective,workspace);if(problem){await drop();return problem}}
   // run Haiku 21/10: il modello chiede conferma nella bozza («…a 13,50 €. Confermi?») su una modifica → il server non scrive:
   // proposta in attesa dell'OK (mai un testo che chiede conferma sopra a una scrittura già fatta).
   // Sostituzione dei piatti di oggi («stasera primi …»): si applica subito, «annulla» entro 10 minuti è la rete (banco prezzofisso 21/10).
   const asksOk=engine==='haiku'&&!answered&&draftAsksOkOnDate(effective,String(finalRun.decision.draft??''),text)
   // regola svuota/inserisci (22/10): si applica subito, «annulla» entro 10 minuti è la rete (decisione Manuel: niente domande)
   const why=pre?.why==='regola'||pre?.why==='regola-elimina'||pre?.why==='risposta-elimina'?null:approval(effective,refs,text,answered)??(asksOk?'recap':null)
   // Eliminazioni insieme ad altre modifiche (Y1): le parti chiare si pubblicano subito, le eliminazioni aspettano il «sì».
   if(why==='delete'){const dels=effective.filter(a=>a.kind==='delete'&&!a.undoCreate&&!a.soft),rest=effective.filter(a=>!dels.includes(a))
    if(rest.length&&!approval(rest,refs,text,answered)){const r=await applyNow(rest);await propose(tx,ctx,r.revision,{kind:'batch',actions:dels,requiresTypedOk:true,why:'delete'});return say([r.facts,pendingFacts('delete',dels,refs,sections)].filter(Boolean).join('\n\n'),r.allOk,pricesOf(effective))}}
   // notte 22/10 (cc-prezzo-01 «la carbonara a 1300»): prezzo fuori scala = una DOMANDA del server (sì / prezzo giusto), mai la bozza
   // del modello che diceva «Rispondi OK per pubblicare» come se fosse un riepilogo qualunque.
   if(why==='price'&&engine==='haiku'){await drop();await propose(tx,ctx,row.revision,{kind:'batch',actions:effective,requiresTypedOk:true,why});return priceAskText(effective,refs,sections)}
   const zeroN=engine==='haiku'&&why==='recap'?effective.filter(a=>a.kind==='price'&&a.price<=0).length:0
   if(why&&wholeSec){await drop();await propose(tx,ctx,row.revision,{kind:'batch',actions:effective,requiresTypedOk:true,why});return 'Nascondo tutto il sottomenu *'+safe(wholeSec.name)+'*'+(base.menus.length>1?' (Menu *'+safe(wholeSec.menu.replace(/^men[uù]\s+/i,''))+'*)':'')+' ('+wholeSec.items+(wholeSec.items===1?' piatto':' piatti')+'): i clienti non lo vedranno finché non scrivi «rendi visibile '+wholeSec.name.toLowerCase()+'». Rispondi *sì* per confermare.'}
   if(why&&engine==='haiku'&&wholeGroup(effective,refs,sections)){await drop();await propose(tx,ctx,row.revision,{kind:'batch',actions:effective,requiresTypedOk:true,why});return wholeGroupText(wholeGroup(effective,refs,sections)!)}
   if(why){await drop();await propose(tx,ctx,row.revision,{kind:'batch',actions:effective,requiresTypedOk:true,why});const whole=engine==='haiku'?wholeGroup(effective,refs,sections):null;return say([zeroN?'Metto a *0 €* '+(zeroN===1?'1 piatto':zeroN+' piatti')+': con 0 € nel menu il prezzo non si vede. Rispondi *OK* per confermare oppure *annulla*.':'',whole?wholeGroupText(whole):pendingFacts(why,effective,refs,sections),already].filter(Boolean).join('\n\n'),false,pricesOf(effective))}
   const r=await applyNow(effective)
   // 24/10: piatto appena eliminato rimesso («rimettila», «rimetti la lasagna»): testo semplice, niente «Nuovo piatto … senza prezzo»
   if(pre?.why==='ripristino'&&r.allOk&&effective.every(a=>a.kind==='create')){const ns=effective.map(a=>'*'+safe((a as any).name)+'*'),sc=sections.find(x=>x.id===(effective[0] as any).sectionId);return 'Ok, rimess'+(ns.length===1?'o ':'i ')+ns.join(', ')+(sc?' nei *'+safe(sc.name)+'* del '+mLabelOf(sc.menu):'')+'.\n\n'+UNDO_HINT}
   if(pre?.why==='regola-elimina'&&r.allOk){const a0=effective[0] as any;return 'Fatto: il '+mLabelOf(String(a0?.name??''))+' è eliminato, con i suoi sottomenu e piatti.\n\nPer tornare come prima scrivi *annulla* entro 10 minuti.'}
   // 23/10: regole di divisione imparate (risposta «1/2» o correzione) solo dopo la scrittura riuscita; il pezzo dubbio si chiede DOPO
   if(pre?.why==='regola'&&ruleLearn.length&&r.allOk)await saveSplitRules(db as any,ctx.tenant,ruleLearn,ruleFix?'correction':'clarify')
   if(pre?.why==='regola'&&ruleFix)return [ruleFix,r.inherited,r.allOk?'':r.facts,UNDO_HINT].filter(Boolean).join('\n\n')
   if(pre?.why==='regola'&&ruleRep){const txt=ruleReply(ruleRep,refs.filter(x=>x.menu===ruleRep!.menu),effective,true,r.inherited+(r.allOk?'':'\n\n'+r.facts))
    if(!ruleAsk)return txt
    const q=ruleAsk.question,w=ruleAsk.wait;await propose(tx,ctx,r.revision,{kind:'brain_ask',question:q,ids:[],actions:[],source:text.slice(0,600),origin:text.slice(0,600),rounds:1,rule:w} as any)
    // 28/10 sera: contesto del sottomenu svuotato (silent): la risposta dice già «Ora scrivimi i piatti nuovi», nessuna domanda in più
    return ruleAsk.silent?txt:txt+'\n\n'+q}
   // Prova dal vivo 21/10: aumento/ribasso uniforme applicato subito → solo il testo del server (la bozza prometteva un riepilogo e
   // nominava come «lasciati fuori» piatti che invece erano stati cambiati).
   if(engine==='haiku'&&r.allOk){const dl=uniformDelta(effective,refs);if(dl!==null)return [uniformReply(dl,effective.length,r.facts),already,UNDO_HINT].filter(Boolean).join('\n\n')
    // 21/10 sera: «tutte le paste a 9» = stesso prezzo su tutto il gruppo, applicato subito, testo del server con «annulla».
    const tg=uniformTarget(effective);if(tg!==null&&/\btutt[ieoa]\b/.test(plain(text)))return [uniformTargetReply(tg,effective.length,r.facts),already,UNDO_HINT].filter(Boolean).join('\n\n')
    if(effective.every(a=>a.kind==='rename_menu'||a.kind==='rename_section'||a.kind==='rename'))return [r.facts,UNDO_HINT].join('\n\n')}
   // run Haiku 21/10 (decisione Manuel): solo struttura → testo del server, chiaro su cosa vedono i clienti (niente bozza del modello).
   if(engine==='haiku'&&r.allOk&&effective.some(a=>(a as any).fromReplace))return replaceReply(effective,refs,sections,r.inherited) // 22/10: nota foto PRIMA di «annulla»
   if(engine==='haiku'&&r.allOk&&effective.every(isStructAction)&&effective.some(a=>a.kind==='create_menu'||a.kind==='create_section'||a.kind==='set_menu_active'||a.kind==='set_section_active'||a.kind==='set_formula'||a.kind==='delete_formula'||a.kind==='set_menu_pricing'))return structureReply(effective,refs,sections,new Set(base.menus.filter(m=>!m.active).map(m=>m.name)))
   // 22/10 notte: piatti eliminati con «togli/leva/nascondi» (subito, senza «sì»): la rete è «annulla» entro 10 minuti.
   return say([r.facts,already,effective.some(a=>a.kind==='delete'&&(a as any).soft)&&r.allOk?UNDO_HINT:''].filter(Boolean).join('\n\n'),r.allOk,pricesOf(effective))}
  const core=async():Promise<string>=>{switch(out.kind){
   case 'undo':{const before=structuredClone(workspace) as any,res=applyUndo(workspace,undoRec!);if(!res.ok)return fill(copy.undoConflict,{piatti:res.changed.slice(0,4).map(n=>'*'+safe(n)+'*').join(', ')})
    const next=workspaceSchema.parse(workspace),saved=await applyBotChange(ctx.tenant,ctx.actor,['WhatsApp: annullamento','WhatsApp: annullamento pubblicato'],{expectedPublishedRevision:live.revision,next},tx as unknown as DB);await writeUndo(tx,ctx.phone,null);await writeLast(tx,ctx.phone,null);await drop()
    // notte 22/10 (n-pf annulla): annullare il prezzo di un'opzione (Completo, Solo primo…) mostra il prezzo tornato, non solo la bozza.
    const prevF=new Map<string,number>(((before.menus??[]) as any[]).flatMap(m=>((m.formulas??[]) as any[]).map(f=>[String(f.id),Number(f.price)] as [string,number])))
    const fx=((next as any).menus??[] as any[]).flatMap((m:any)=>((m.formulas??[]) as any[]).filter(f=>prevF.has(String(f.id))&&Math.abs(prevF.get(String(f.id))!-Number(f.price))>=0.005).map(f=>'*'+safe(f.name)+'* del *'+safe(m.name)+'*: di nuovo *'+Number(f.price).toFixed(2).replace('.',',')+' €*'))
    // 22/10 (QA foto su due omonimi): stesso nome in più Menu → il Menu accanto al nome; testo del server (mai un solo Menu citato dal modello).
    const allN=[...res.restored,...res.removed],dupN=(n:string)=>allN.filter(x=>plain(x)===plain(n)).length>1,used=new Set<string>()
    const lab=(n:string)=>{if(!dupN(n))return safe(n);const it=(undoRec!.items??[]).find(i=>!used.has(i.id)&&String(i.before?.name??i.after?.name??'')===n);if(!it)return safe(n);used.add(it.id);const m=refs.find(r=>r.id===it.id)?.menu;return safe(n)+(m?' ('+safe(m)+')':'')}
    const fm=undoRec!.full?.names.restoredMenus,lines=[...res.restored.map((n,i)=>fill(copy.undoRestored,{piatto:fm&&fm[i]&&dupN(n)?safe(n)+' ('+safe(fm[i]!)+')':lab(n)})),...res.removed.map(n=>fill(copy.undoRemoved,{piatto:lab(n)})),...fx].join('\n')
    if(engine==='haiku')return ['Ok, annullo l’ultima modifica.',lines].filter(Boolean).join('\n\n')
    return say(lines,true)}
   // notte 22/10 (n-annulla-domanda): chiudere una domanda o una bozza non è «annullare l’ultima pubblicazione»: testo fisso, mai la bozza.
   case 'cancel':await drop();if(engine==='haiku'&&pend&&pend.kind!=='batch')return dropText;return say('',false)
   case 'confirm':{const stored=pend&&(pend.kind==='batch'||pend.kind==='hold')?storedActions({kind:'batch',actions:pend.actions},refs,sections):null;if(!stored){await drop();return copy.menuChanged}
    const exIds=new Set((finalRun.decision.exclude??[]).map(e=>e.id)),all=(pend!.kind==='hold'?mergeMenuActions(stored,out.extra):stored).filter(a=>!(a.kind==='create'&&negatedName(text,a.name))&&!('id' in a&&exIds.has((a as any).id)&&!out.extra.includes(a)))
    // Una conferma di riepilogo pubblica; le risposte alle parti incerte passano dagli stessi vincoli di una richiesta nuova.
    if(pend!.kind==='batch'){const effective=effectiveMenuActions(all,workspace);if(!effective.length){await drop();return say(copy.noChanges,false)}
     // «sì e anche il tiramisù» (notte 22/10): la parte nuova passa dagli stessi vincoli di una richiesta nuova (eliminare = serve il suo sì).
     const ex=engine==='haiku'&&out.extra.length?effectiveMenuActions(out.extra.filter(a=>!effective.some(e=>JSON.stringify(e)===JSON.stringify(a))),structuredClone(workspace)):[],w=ex.length?approval(ex,refs,text,false):null
     const r=await applyNow(w?effective:[...effective,...ex],['WhatsApp: bozza confermata','WhatsApp: pubblicazione confermata'])
     if(w){await propose(tx,ctx,r.revision,{kind:'batch',actions:ex,requiresTypedOk:true,why:w});const dn=ex.flatMap(a=>a.kind==='delete'?[refs.find(x=>x.id===a.id)?.name]:[]).filter(Boolean).map(n=>'*'+safe(n!)+'*')
      return [r.facts,w==='delete'&&dn.length?'Elimino anche '+dn.join(' e ')+'? Rispondi *sì*.':w==='price'?'':'Il resto non è ancora pubblicato: rispondi *OK* per confermarlo.',pendingFacts(w,ex,refs,sections)].filter(Boolean).join('\n\n')}
     return say(r.facts,r.allOk,pricesOf(effective))}
    return publish(all)}
   case 'change':{
    // «sì, solo il babà» su un'eliminazione in attesa: il sì c'è già, si eliminano solo i piatti scelti (annullabile 10 minuti).
    if(deleteConfirmed){const effective=effectiveMenuActions(out.actions,workspace);if(!effective.length){await drop();return say(copy.noChanges,false)};const r=await applyNow(effective,['WhatsApp: eliminazione confermata','WhatsApp: pubblicazione confermata']);return say(r.facts,r.allOk)}
    // Riepilogo in attesa dell'OK: le correzioni lo aggiornano (e i piatti esclusi escono), resta in attesa.
    if(pend?.kind==='batch'&&(pend.why==='recap'||pend.why==='price')){const ex=new Set((finalRun.decision.exclude??[]).map(e=>e.id)),outIds=new Set(out.actions.flatMap(a=>'id' in a?[(a as any).id as string]:[])),namedOff=engine==='haiku'?new Set(pend.actions.flatMap(a=>'id' in a&&!outIds.has((a as any).id)&&g9DishMentioned(refs.find(r=>r.id===(a as any).id)?.name??'\u0000',text,refs)?[(a as any).id as string]:[])):new Set<string>(),merged=mergeMenuActions(pend.actions.filter(a=>!('id' in a)||!namedOff.has((a as any).id)),out.actions).filter(a=>!('id' in a)||!ex.has((a as any).id)||out.actions.includes(a))
     const effective=effectiveMenuActions(merged,workspace);await drop();if(!effective.length)return say(copy.noChanges,false)
     // notte 22/10 (cc-prezzo-01): «scusa, 13» dopo «la carbonara a 1300?»: il prezzo corretto non è più strano → si pubblica subito.
     if(engine==='haiku'&&pend.why==='price'&&!approval(effective,refs,text,answered)){const r=await applyNow(effective);return say(r.facts,r.allOk,pricesOf(effective))}
     if(engine==='haiku'&&approval(effective,refs,text,answered)==='price')return (await propose(tx,ctx,row.revision,{kind:'batch',actions:effective,requiresTypedOk:true,why:'price'}),priceAskText(effective,refs,sections))
     await propose(tx,ctx,row.revision,{kind:'batch',actions:effective,requiresTypedOk:true,why:approval(effective,refs,text,answered)??pend.why});return say(pendingFacts(approval(effective,refs,text,answered)??pend.why,effective,refs,sections),false,pricesOf(effective))}
    // run Haiku 21/10 (bv-deixis-001): le parti chiare di un sospeso (hold) chieste dal titolare si pubblicano con la modifica dopo,
    // salvo quelle che il messaggio nega; prima restavano perse quando la risposta era un'altra modifica.
    // Mai se il titolare sta correggendo («no, fai una cosa…», «invece…»): le parti in sospeso possono essere proprio quelle che cambia.
    // notte 22/10 (bv-correzioni-002 «No, ho detto togli boh»): una correzione che NON nomina nessuna parte in attesa corregge solo la
    // domanda; le parti chiare restano e si pubblicano (prima il «no/ho detto» le buttava tutte: tiramisù perso).
    const heldNamed=(()=>{const h=pend?.kind==='hold'?pend.actions:pend?.kind==='ask'?(pend.ask.actions??[]):[];return h.some(a=>'id' in a?g9DishMentioned(refs.find(r=>r.id===(a as any).id)?.name??'\u0000',text,refs):a.kind==='create'&&g9DishMentioned(a.name,text,refs))})()
    if(engine==='haiku'&&(!/^(?:no|ah no|aspetta|anzi)\b|\b(?:invece|fai una cosa|ho detto|intendevo)\b/.test(plain(text))||!heldNamed)&&(pend?.kind==='hold'||(pend?.kind==='ask'&&(pend.ask.twins?.length??0)>0&&(pend.ask.actions?.length??0)>0))){const held=storedActions({kind:'batch',actions:pend.kind==='hold'?pend.actions:(pend.ask.actions??[])},refs,sections)??[],keep=held.filter(a=>!('id' in a&&negatedName(text,refs.find(r=>r.id===(a as any).id)?.name??'\u0000'))&&!(a.kind==='create'&&negatedName(text,a.name)));if(keep.length)return publish(mergeMenuActions(keep,out.actions))}
    return publish(out.actions)}
   case 'ask':{
    // run Haiku 21/10: le righe che non cambiano niente («da 6 € a 6 €») non entrano nelle parti in attesa (confondevano «quei due»).
    if(engine==='haiku'){const keep=(l:MenuAction[])=>effectiveMenuActions(l,structuredClone(workspace));out.actions=keep(out.actions);if(out.hold)out.hold={...out.hold,actions:keep(out.hold.actions)}}
    const keepRecap=pend?.kind==='batch'&&(pend.why==='recap'||pend.why==='price')&&!(engine==='haiku'&&pend.actions.some(a=>'id' in a&&g9DishMentioned(refs.find(r=>r.id===(a as any).id)?.name??'\u0000',text,refs)))
    let question=serverQ??(noDraft||actedDraft(finalRun)?'':cleanDraft(finalRun.decision.draft,{wrote:false,numbers:numbersOK(finalRun,[...out.ids.map(id=>refs.find(r=>r.id===id)?.price??-1),...(out.twins??[]).flatMap(t=>t.price!=null?[t.price]:[]),...out.actions.flatMap(a=>'price' in a&&typeof (a as any).price==='number'?[(a as any).price as number]:[])])})??'')
    // notte 22/10 (qa-continua: «aggiungi le patatine fritte» → domanda del modello senza bozza → «4» → stessa domanda; «aggiungi il vitello
    // tonnato nei Primi del Menu di verifica» → «Cosa vuoi cambiare?»): ogni domanda su un piatto NUOVO salva la bozza (nome, prezzo,
    // sottomenu detti) e chiede solo ciò che manca, con un testo del server se quello del modello non è una domanda utile.
    // la bozza in sospeso (nome già detto) resta: il prezzo o il sottomenu detti adesso la completano (cc-qv-03 «3,50» → poi «nei primi»).
    if(engine==='haiku'&&pend?.kind==='ask'&&pend.ask.draft?.name&&(!out.createDraft||!out.createDraft.name)){const pd0=pend.ask.draft,op=onlyPrice(draftless(text,pd0.name));out.createDraft={...pd0,price:out.createDraft?.price??op??pd0.price??null,sectionId:out.createDraft?.sectionId??pd0.sectionId??null}}
    if(engine==='haiku'&&!out.hold&&!out.actions.length&&!out.ids.length&&!out.twins?.length&&(!out.createDraft||!out.createDraft.sectionId)){const nm=out.createDraft?.name||newDishName(text,refs);if(nm){const nsA=namedSections(text,sections).ids.filter(id=>!fixedSecIds.has(id)),nsL=nsA.filter(id=>{const x=sections.find(z=>z.id===id);return !!x&&base.menus.some(m=>m.name===x.menu&&m.active!==false&&(m.secs as any[]).find(z=>z.id===id)?.active!==false)}),ns=nsA.length>1&&nsL.length?nsL:nsA,ms=namedMenus(text,base.menus).map(m=>m.name),ns2=ns.length>1&&ms.length===1?ns.filter(id=>sections.find(x=>x.id===id)?.menu===ms[0]):ns,gp=[...new Set(g9Prices(text))]
     out.createDraft={...{name:nm,price:out.createDraft?.price??(/\d/.test(text)&&gp.length===1&&gp[0]!>0?gp[0]!:null),sectionId:ns2.length===1?ns2[0]!:null,sectionName:null}}}}
    if(engine==='haiku'&&out.createDraft?.name&&!serverQ&&(!/\?/.test(question)||/^cosa vuoi cambiare\?/i.test(question.trim())||(out.createDraft.price==null&&!/prezz|quanto|cost/i.test(question))||(!out.createDraft.sectionId&&(!/sottomenu|dove|in quale|quale sezione|nei |negli |nelle /i.test(question)||sections.some(x=>plain(x.name).length>=4&&(' '+plain(question)+' ').includes(' '+plain(x.name)+' ')))))){ // fase 3: la domanda chiede SEMPRE ciò che manca (QA live: solo il sottomenu, prezzo dimenticato)
    const d=out.createDraft,sc=d.sectionId?sections.find(x=>x.id===d.sectionId):undefined,eur=(n:number)=>n.toFixed(2).replace('.',',')+' €'
     question=sc&&d.price==null?'A che prezzo metto *'+safe(d.name)+'* in *'+safe(sc.name)+'*? Scrivimi per esempio «'+d.name.toLowerCase()+' 12».':!sc&&d.price!=null?'Ok, *'+eur(d.price)+'*. In quale sottomenu metto *'+safe(d.name)+'*?':'In quale sottomenu metto *'+safe(d.name)+'* e a che prezzo?'}
    // 22/10 (v139): una domanda di conferma («…? Rispondi sì», «Vuoi che…», «Aggiungo…?») parte SOLO con azioni salvate da eseguire al «sì»;
    // senza, diventa una domanda specifica (mai un «sì» che poi gira a vuoto).
    // 23/10 (chat Luisa «Vuoi aggiungere questi piatti nei *Primi* del *Menu Giorno*?» → «Si» → «Non c’è niente da confermare»): una domanda di
    // AGGIUNTA senza azioni prende i piatti del messaggio (letti dal server) e li mostra uno per riga: il «sì» li aggiunge.
    if(engine==='haiku'&&!serverQ&&!out.actions.length&&!out.hold&&!out.twins?.length&&!out.ids.length&&/\?/.test(question)&&/\b(?:aggiung\w*|inser\w*|mett\w*)\b/.test(plain(question))){let hist2:{role:string,text:string,at:number}[]=[];try{hist2=await sqlBrainStore(tx).readHistory(ctx.tenant,ctx.phone,Date.now())}catch{/* solo il Menu della domanda */} // DENTRO la transazione: sull'edge il pool ha UNA connessione (db qui = blocco)
     const iq=insertForQuestion(question,text,{menus:base.menus,sections,refs,lexicon,history:hist2});if(iq){out.actions=iq.actions;question=iq.question}}
    // Una domanda che chiede di ELIMINARE i piatti elencati (candidati salvati) è consumabile: il «sì» li elimina (ramo della risposta).
    const delQ=out.ids.length>0&&/\b(?:elimin\w*|cancell\w*|togli\w*|lev[ao]\w*|rimuov\w*)\b/.test(plain(question))
    if(engine==='haiku'&&!serverQ&&!delQ&&!out.actions.length&&!out.hold&&!out.twins?.length&&!out.createDraft&&/\brispondi\s+\*?s[iì](?![a-z])|\brispondi\s+\*?ok\b|\bvuoi che\b|\bvuoi (?:aggiungere|inserire|mettere|eliminare|togliere|cancellare|creare|spostare|cambiare|nascondere|rinominare)\b|\bconfermi\b|\blo faccio\?|^(?:ok,?\s*)?(?:aggiungo|creo|metto|tolgo|nascondo|sposto|cambio|elimino|rinomino|porto|inserisco)\b[^?\n]*\?/i.test(question))question=askFor(text,out.ids.map(id=>refs.find(r=>r.id===id)).filter((r):r is MenuRef=>!!r).filter((r,_i,all)=>all.length>=2||fullyNamed(r.name,text)||spelledAlike(text,r.name)))
    if(engine==='haiku'&&question&&!serverQ){const q3=dropInventedGroups(question,groupNames,askText);question=q3&&/\?/.test(q3)?q3:q3&&q3===question?q3:''}
    // notte 22/10 (lng-mig-3/4): una domanda su parti incerte non chiede anche «Rispondi OK per pubblicare» (due richieste insieme: il
    // titolare non sa a cosa rispondere). Resta la domanda; le parti chiare in attesa le mostrano i fatti.
    if(engine==='haiku'&&out.hold&&/\?/.test(question)){const q2=question.split(/(?<=[.!?])\s+/).filter(x=>!/\brispondi\s+\*?ok\b|\bper pubblicar/i.test(x)).join(' ').trim();if(/\?/.test(q2))question=q2}
    // 21/10 sera: il source è al massimo «richiesta originale + ultima risposta» (prima accumulava ogni messaggio dopo la domanda).
    // Tetto: la stessa domanda in sospeso vive al massimo 2 giri; al terzo la domanda vecchia si chiude e resta solo questo messaggio.
    const src0=nextAskSource(pend?.kind==='ask'?pend.ask as any:null,text),src=src0.rounds>ASK_MAX_ROUNDS?nextAskSource(null,text):src0
    // 21/10 sera: niente pending vuoto («Ok, lascio stare.» senza nulla in sospeso) — confonde il turno dopo.
    const emptyAsk=engine==='haiku'&&!noDraft&&!!question&&!out.hold&&!/\?|\brispondi\b/i.test(question)&&!out.ids.length&&!out.actions.length&&!out.createDraft&&!sessOut&&!out.twins?.length
    if(!keepRecap&&emptyAsk)await drop()
    else if(!keepRecap){await drop();if(out.hold)await propose(tx,ctx,row.revision,{...out.hold,source:text});else await propose(tx,ctx,row.revision,{kind:'brain_ask',question,ids:out.ids.filter(id=>refs.some(r=>r.id===id)).slice(0,8),actions:out.actions.length?out.actions:pend?.kind==='ask'&&!out.ids.length?pend.ask.actions??[]:[],source:src.source,origin:src.origin,rounds:src.rounds,...(sessOut?{session:sessOut,rounds:1}:{}),draft:out.createDraft??(pend?.kind==='ask'?pend.ask.draft??null:null),...((out as any).secOptions?{secOptions:(out as any).secOptions}:{}),...(out.twins?.length?{twins:out.twins}:{})} satisfies BrainAsk)}
    // R9: domanda sui piatti con lo stesso nome: i fatti mostrano le parti in attesa (numerate) e i piatti già nel menu.
    const facts=out.hold?holdFacts(out.hold,refs,sections):out.twins?.length?[out.actions.length?'Non ancora pubblicato:\n'+out.actions.map((a,i)=>(i+1)+'. '+describeAction(a,refs,withNewSections(sections,out.actions))).join('\n'):'','Già nel menu:\n'+candidateFacts(out.ids.slice(0,8),refs)].filter(Boolean).join('\n\n'):out.ids.length>=2||(!question&&out.ids.length)?candidateFacts(out.ids.slice(0,8),refs):''
    // R8: senza una domanda del modello utilizzabile, mai il solo «Non ho cambiato nulla.» su una richiesta capita: i fatti dicono
    // cosa NON è stato salvato (azioni capite) e i piatti in questione. Nessuna frase del bot oltre ai fatti.
    // Menu a prezzo fisso (banco prezzofisso 21/10, pf-piatto-nuovo-08): «la lasagna a 8» su un piatto di un Menu fisso, senza una domanda
    // del modello utilizzabile → il fatto del menu (i piatti non hanno prezzo, le opzioni sì), mai il solo «Non ho cambiato nulla».
    if(!question&&!out.hold&&/\d|\b(?:euro|prezz\w*|costa\w*)\b/i.test(text)){const fx=fixedDishFact([...out.ids,...out.actions.flatMap(a=>'id' in a?[(a as any).id as string]:[])],refs,base.menus);if(fx)return fx}
    const unsaved=!question&&!out.hold&&!out.twins?.length&&out.actions.length?unsavedText(out.actions.slice(0,8).map(a=>describeAction(a,refs,withNewSections(sections,out.actions)))):''
    return [question,question||missingSection?'':NOTHING,unsaved,facts,missingSection].filter(Boolean).join('\n\n')}
   // Opzioni di un Menu a prezzo fisso: i fatti del server bastano (la bozza ripeteva gli stessi prezzi).
   case 'read':if(out.plan?.read==='formulas')return planText(out.plan,refs,sections)
    // fase 3 (QA v149 «quanto costa il riso giallo?» → «Il riso giallo costa 8 €. *tiramisù*: 15 €»): la scheda sotto la lettura è dei piatti
    // nominati nel messaggio; se il modello ha indicato solo piatti NON nominati, valgono quelli nominati.
    if(engine==='haiku'&&out.plan?.read==='items'&&Array.isArray(out.plan.ids)&&out.plan.ids.length){const said=refs.filter(r=>g9DishMentioned(r.name,text,refs)),top=said.filter(r=>!said.some(o=>o.id!==r.id&&plain(o.name).includes(plain(r.name))))
     if(top.length&&top.length<=6&&!out.plan.ids.some((id:string)=>said.some(r=>r.id===id)))(out.plan as any).ids=top.map(r=>r.id)}
    // notte 22/10 (QA v143 «quante paste ho nei primi?» → piatti di altri sottomenu e di un altro Menu): la lettura di un sottomenu
    // nominato la compone il server dai dati — solo i piatti che stanno davvero lì, raggruppati per Menu; la bozza del modello non parte.
    if(engine==='haiku'&&out.plan?.read==='items'&&Array.isArray(out.plan.ids)){const ns0=namedSections(text,sections).ids,nmR=namedMenus(text,base.menus)
     // fase 3 (qa-continua-rapida «cosa c'è nei primi?» → i Primi del Menu del giorno NASCOSTO, scelti dal contesto vecchio): senza un Menu
     // detto valgono i sottomenu visibili con piatti; con un Menu detto, solo i suoi.
     const secOk=(id:string)=>{const x=sections.find(z=>z.id===id),m=x?base.menus.find(mm=>mm.name===x.menu):undefined,i=m?(m.secs as any[]).find(z=>z.id===id):undefined;return !!m&&m.active!==false&&i?.active!==false&&(i?.items??0)>0}
     const nsM=nmR.length?ns0.filter(id=>nmR.some(m=>m.name===sections.find(z=>z.id===id)?.menu)):ns0.filter(secOk),ns=nsM.length?nsM:ns0
     // fase 3 (qa-continua «quanti piatti ho nei Primi del Menu di verifica?» → 3 piatti su 4): una domanda su TUTTO il sottomenu li elenca tutti.
     const whole=/\b(?:quanti piatti|che piatti|quali piatti|cosa c e|cosa ce|cosa ho|che cosa c e|elenca\w*|tutti i piatti|fammi vedere)\b/.test(plain(text))
     if(ns.length){const inSec=refs.filter(r=>ns.includes(r.sectionId??'')),picked=inSec.filter(r=>out.plan.ids.includes(r.id)),list=picked.length&&!whole?picked:inSec
      if(out.plan.ids.some((id:string)=>!inSec.some(r=>r.id===id))||!picked.length||(whole&&picked.length<inSec.length)){const by=new Map<string,MenuRef[]>();for(const r of list){const k=(r.sectionId??'');by.set(k,[...(by.get(k)??[]),r])}
       const lines=[...by].map(([sid,rs])=>{const sc=sections.find(x=>x.id===sid);return 'Nei *'+safe(sc?.name??'')+'* del *'+safe(sc?.menu??'')+'* '+(rs.length===1?'c\u2019è 1 piatto':'ci sono '+rs.length+' piatti')+(rs.some(r=>r.hidden)?' ('+rs.filter(r=>r.hidden).length+' nascost'+(rs.filter(r=>r.hidden).length===1?'o':'i')+')':'')+':'})
       if(!list.length)return 'Nei *'+safe(sections.find(x=>x.id===ns[0])?.name??'')+'* non c\u2019è nessun piatto.'
       return [lines.length===1?lines[0]!:lines.join('\n'),planText({type:'read',read:'items',ids:list.map(r=>r.id)} as any,refs,sections)].join('\n\n')}}}
    return say(planText(out.plan,refs,sections),false,pricesOf(out.plan.ids?.map((id:string)=>({kind:'available',id,value:true}) as MenuAction)??[]))
   case 'say':{const p=finalRun.decision.plan as any,ids=p?.type==='capability'&&Array.isArray(p.ids)?(p.ids as string[]).filter(i=>i==='dashboard'||i==='menulink'):[];if(ids.length)return capabilityText(ids);return say('',false)}}
   return NOTHING}
  // Una domanda chiusa (comando nuovo, 2° giro) non resta in sospeso anche se questo turno non scrive.
  if(closePend&&engine==='haiku')await drop()
  let res=await core()
  // 21/10 sera, rete di sicurezza sulle risposte: piatto nuovo in un sottomenu appena creato senza prezzo → la domanda del prezzo
  // (bozza in sospeso); mai «Non ho cambiato nulla» dopo un comando chiaro; mai la stessa domanda due volte di fila.
  if(engine==='haiku'){
   if(sessAfter&&wroteActs.length){await propose(tx,ctx,lastRev,{kind:'brain_ask',question:'',ids:[],actions:[],source:text.slice(0,600),origin:text.slice(0,600),rounds:1,session:sessAfter} as any);if(sessNote)res=sessNote+'\n\n'+res}
   else if(follow&&wroteActs.some(a=>a.kind==='create_section')){const q='A che prezzo metto *'+safe(follow.name)+'* nei *'+safe(follow.sectionName)+'*?'
    await propose(tx,ctx,lastRev,{kind:'brain_ask',question:q,ids:[],actions:[],source:follow.origin,origin:follow.origin,rounds:1,draft:{name:follow.name,price:null,sectionId:follow.sectionId,sectionName:null,fresh:true} as any} satisfies BrainAsk);res=res+'\n\n'+q}
   else if(!wroteActs.length&&out.kind!=='cancel'&&out.kind!=='undo'){const blocks=res.split('\n\n'),first=blocks[0]!.trim()
    const cands0=(out.kind==='ask'?out.ids:[]).map(id=>refs.find(r=>r.id===id)).filter((r):r is MenuRef=>!!r).slice(0,8)
    // 28/10 sera (prova dal vivo: «togli le scaloppine dal menu cena» elencava quelle Alla carta; «il nodino è tornato» elencava piatti
    // sempre disponibili): candidati solo del Menu detto e, per finito/tornato, solo quelli nello stato opposto. Se ne resta uno, una
    // domanda sì/no su quello.
    const cands=((xs:MenuRef[])=>{let c=xs;const ms=menusAll(text,base.menus);if(ms.length===1){const f=c.filter(r=>r.menu===ms[0]!.name);if(f.length)c=f}
     const pt=plain(text);if(/\b(?:tornat\w*|di nuovo|rimett\w*|disponibil\w*|riattiv\w*)\b/.test(pt)){const f=c.filter(r=>r.available===false);if(f.length)c=f}
     else if(/\b(?:finit\w*|esaurit\w*|terminat\w*|non c e piu)\b/.test(pt)){const f=c.filter(r=>r.available!==false&&!r.hidden);if(f.length)c=f}
     return c})(cands0)
    if(/^Non ho cambiato nulla\.?$/.test(first)&&!pend&&isAffirmative(text))res=['Non c\u2019è niente in sospeso: dimmi pure cosa vuoi cambiare.',...blocks.slice(1)].join('\n\n')
    // 24/10 (chat Manuel 18:10 «si» → «Non ho cambiato nulla. 1. *Lasagna*»): il sì alla TUA domanda che il server non riesce a eseguire non
    // ripete la lista: lo dice e chiede la richiesta intera (la domanda si chiude, mai un secondo «sì» a vuoto).
    else if(/^Non ho cambiato nulla\.?$/.test(first)&&pend&&isAffirmative(text)&&lastQ){res='Non sono riuscito a farlo con il «sì»: riscrivimi la richiesta per intero, per esempio «togli la lasagna, metti i rigatoni». Non ho cambiato nulla.';await tx.execute(sql`DELETE FROM tako_whatsapp_proposals WHERE phone=${ctx.phone} AND actor_id=${ctx.actor} AND restaurant_id=${ctx.tenant}`)}
    // notte 22/10 (Fix A: z-asr-005, z-r2-spezzati-003 «la birra a sei e cinque»): «Non ho cambiato nulla.» + un solo piatto in elenco,
    // senza domanda, su un messaggio con un prezzo (anche a parole) → sempre una domanda. Con UN piatto e UN prezzo detto senza dubbi, la
    // domanda porta l'azione pronta («Intendi *Birra* a 6 €? Rispondi sì»): il «sì» la applica (mai un sì che gira a vuoto).
    const otherNamed=(id:string)=>refs.some(r=>r.id!==id&&plain(r.name).length>=4&&(' '+plain(text)+' ').includes(' '+plain(r.name)+' ')&&!(' '+plain(refs.find(z=>z.id===id)?.name??'')+' ').includes(' '+plain(r.name)+' '))
    const saidP=[...new Set(g9Prices(text).map(x=>Math.round(x*100)/100))],onePriced=cands.length===1&&!otherNamed(cands[0]!.id)&&(fullyNamed(cands[0]!.name,text)||spelledAlike(text,cands[0]!.name))/* 24/10: mai «Intendi *Pirata*?» per «tiramisu» */&&saidP.length===1&&saidP[0]!>0&&!relativeDelta(text)&&!/\b(?:nascond\w*|togli\w*|finit\w*|esaurit\w*|elimin\w*|cancell\w*|aggiung\w*|rinomin\w*|evidenz\w*)\b/.test(plain(text))
    const nothing=/^Non ho cambiato nulla\.?$/.test(first)&&(clearCommand(text)||cands.length>=2||cands.length===1&&(saidP.length>0||plain(text).split(' ').length>=3)||(/\d/.test(text)&&plain(text).split(' ').length>=3)),again=!!lastQ&&/\?/.test(first)&&(plain(first)===plain(lastQ)||(!serverQ&&sameQuestion(first,lastQ)))
    // notte 22/10 (ps-06 «la ghisa a dodici» → «Quale piatto vuoi mettere a 12 €?»): domanda generica che non nomina nessun piatto, un
    // solo piatto che SUONA come quello detto e un prezzo chiaro → la domanda propone quel piatto con l'azione pronta (sì = applica).
    const generic=!serverQ&&!cands.length&&!pend&&/\?/.test(first)&&!relativeDelta(text)&&!groupPercent(text)&&!/\btutt[ieoa]\b/.test(plain(text))&&!sectionGroupWord(plain(text),sections,refs)&&!refs.some(r=>plain(r.name).length>=3&&(' '+plain(first)+' ').includes(' '+plain(r.name)+' '))
    const p1=singlePrice(text)??(()=>{const both=[...new Set([...first.replace(/(\d),(\d{1,2})(?!\d)/g,'$1.$2').matchAll(/\d+(?:\.\d{1,2})?/g)].map(m=>Number(m[0])))].filter(n=>saidP.some(x=>Math.abs(x-n)<0.005));return both.length===1?both[0]!:null})()
    const snd=generic&&p1!==null?(()=>{const h=phoneticHits(text,refs);const ids=[...new Set([...h.strong,...h.weak])];if(ids.length===1)return refs.filter(r=>r.id===ids[0]&&spelledAlike(text,r.name));const l=looseSoundAlike(text,refs);return l.length===1&&(!ids.length||ids.includes(l[0]!.id))&&spelledAlike(text,l[0]!.name)?l:[]})():[] // 24/10: mai un nome che non somiglia (tiramisù → «Pirata»)
    if(snd.length===1&&!otherNamed(snd[0]!.id)&&p1!==null&&p1>0&&!oddPrice({kind:'price',id:snd[0]!.id,price:p1} as MenuAction,refs)&&!/\b(?:nascond\w*|togli\w*|finit\w*|esaurit\w*|elimin\w*|cancell\w*|aggiung\w*|rinomin\w*|evidenz\w*)\b/.test(plain(text))){const r0=snd[0]!,act={kind:'price',id:r0.id,price:p1} as MenuAction,eur=(n:number)=>n.toFixed(2).replace('.',',')+' €'
     const q='Intendi *'+safe(r0.name)+'* a *'+eur(p1)+'* (adesso '+eur(r0.price)+')? Rispondi *sì* oppure dimmi il piatto e il prezzo giusti.'
     await propose(tx,ctx,row.revision,{kind:'brain_ask',question:q,ids:[r0.id],actions:[act],source:text.slice(0,600),origin:text.slice(0,600),rounds:1} satisfies BrainAsk);res=q}
    else if(nothing&&onePriced&&!pend&&!oddPrice({kind:'price',id:cands[0]!.id,price:saidP[0]!} as MenuAction,refs)){const r0=cands[0]!,act={kind:'price',id:r0.id,price:saidP[0]!} as MenuAction,eur=(n:number)=>n.toFixed(2).replace('.',',')+' €'
     const q='Intendi *'+safe(r0.name)+'* a *'+eur(saidP[0]!)+'* (adesso '+eur(r0.price)+')? Rispondi *sì* oppure dimmi il piatto e il prezzo giusti.'
     await propose(tx,ctx,row.revision,{kind:'brain_ask',question:q,ids:[r0.id],actions:[act],source:text.slice(0,600),origin:text.slice(0,600),rounds:1} satisfies BrainAsk);res=q}
    else if(nothing&&cands.length===1&&!otherNamed(cands[0]!.id)&&!pend&&relativeDelta(text)&&cands[0]!.price>0){const r0=cands[0]!,np=Math.round((r0.price+relativeDelta(text)!.delta)*100)/100,eur=(n:number)=>n.toFixed(2).replace('.',',')+' €'
     if(np>0){const q='Porto *'+safe(r0.name)+'* da '+eur(r0.price)+' a *'+eur(np)+'*? Rispondi *sì* oppure dimmi il prezzo giusto.';await propose(tx,ctx,row.revision,{kind:'brain_ask',question:q,ids:[r0.id],actions:[{kind:'price',id:r0.id,price:np} as MenuAction],source:text.slice(0,600),origin:text.slice(0,600),rounds:1} satisfies BrainAsk);res=q}}
    else if(nothing&&cands.length===1&&saidP.length>1&&!/\d/.test(text)&&!relativeDelta(text)&&plain(text).split(' ').length<=7&&!pend){const r0=cands[0]!,q='Per *'+safe(r0.name)+'* (adesso '+r0.price.toFixed(2).replace('.',',')+' €) che prezzo metto? Scrivimelo in cifre, per esempio «'+plain(r0.name).split(' ').slice(0,2).join(' ')+' 6,50».'
     await propose(tx,ctx,row.revision,{kind:'brain_ask',question:q,ids:[r0.id],actions:[],source:text.slice(0,600),origin:text.slice(0,600),rounds:1} satisfies BrainAsk);res=q}
    else if(nothing||again){let q=askFor(text,cands.filter(r=>fullyNamed(r.name,text)||spelledAlike(text,r.name)||cands.length>=2));if(lastQ&&plain(q)===plain(lastQ))q=cands.length>=2?'Rispondi solo col numero del piatto (1, 2…) oppure scrivimi il suo nome.':'Riscrivimi la richiesta per intero, con il piatto e il valore: per esempio «la carbonara a 12».';res=[q,...blocks.slice(1).filter(b=>b.trim()!==NOTHING)].join('\n\n')
     const cur=(await tx.execute(sql`SELECT command,revision FROM tako_whatsapp_proposals WHERE phone=${ctx.phone} AND actor_id=${ctx.actor} AND restaurant_id=${ctx.tenant} AND expires_at>now()`))[0]
     if((cur?.command as any)?.kind==='brain_ask')await propose(tx,ctx,Number(cur!.revision),{...(cur!.command as any),question:q})
     else if(cands.length>=2)await propose(tx,ctx,row.revision,{kind:'brain_ask',question:q,ids:cands.map(r=>r.id),actions:[],source:text.slice(0,600),origin:text.slice(0,600),rounds:1} satisfies BrainAsk)}}}
  return res})
 if(conflict&&engine==='haiku'&&!replay&&!budget.expired)return brainTurnR(ctx,text0,key,ai,budget,voice,true)
 return sheetNote&&result&&result!==copy.menuChanged?result+'\n\n'+sheetNote:result}
const turnFor=(ctx:Ctx,text:string,opts?:Parameters<typeof menuTurn>[3])=>db.transaction(async tx=>{if(opts?.isExpired?.())throw new Error('WhatsApp turn expired');await lock(tx,ctx.phone);const live=await linkedContext(tx,ctx.phone);const result=live?await menuTurn(tx,live,text,opts):'';if(opts?.isExpired?.())throw new Error('WhatsApp turn expired');return result})
/** `engine`: motore del cervello del locale, valorizzato SOLO se il cervello è acceso (PIANO bot-haiku). */
type Budget={expired:boolean,committing?:boolean,failed?:boolean,brain?:boolean,voice?:boolean,engine?:BotEngine}
/** Chiave per un turno che va all'IA: cervello acceso su haiku → ANTHROPIC_API_KEY (foto del piatto escluse: restano su Groq);
 * altrimenti GROQ_API_KEY come prima. Whisper usa sempre GROQ_API_KEY (jobMessage). */
const aiKeyFor=(turn:{photo?:unknown},bs:{brain:boolean,engine:BotEngine}|null)=>bs?.brain&&bs.engine==='haiku'&&!turn.photo?engineKey('haiku'):process.env.GROQ_API_KEY||''
// Watchdog: ogni job in background risponde sempre, anche se un passo si blocca (codec, rete, DB).
const jobTimeoutMs=()=>Number(process.env.TAKO_WHATSAPP_JOB_TIMEOUT_MS)||90_000,photoTimeoutMs=()=>Number(process.env.TAKO_WHATSAPP_PHOTO_TIMEOUT_MS)||40_000
function withTimeout<T>(work:Promise<T>,ms:number,fallback:T):Promise<T>{let timer:ReturnType<typeof setTimeout>|undefined;return Promise.race([work,new Promise<T>(resolve=>{timer=setTimeout(()=>resolve(fallback),ms)})]).finally(()=>clearTimeout(timer))}
const storedUpload=(tenant:string,url:string)=>url.startsWith(`/uploads/${tenant}/`)&&/^[A-Za-z0-9_-]{16}\.(jpg|png|webp)$/.test(url.slice(`/uploads/${tenant}/`.length))
/** Scarica (se serve), riduce i JPEG oltre 2 MP e salva nella galleria del locale: stessa pipeline della dashboard. */
/** 22/10: foto già entro i limiti (es. WhatsApp 1080×1920, 66 KB) → salvata senza codec WASM (passthroughImage), che sull'edge
 *  sforava «CPU Time exceeded» (HTTP 546) e lasciava il titolare senza risposta. Ogni esito negativo che non dipende dalla foto
 *  inviata (download, codec, storage, eccezione, tempo scaduto) finisce anche in tako_whatsapp_errors (kind photo_failed). */
async function prepareUpload(tenant:string,source:{mediaUrl:string}|{bytes:Uint8Array,type:string},phone?:string):Promise<{url:string}|{error:string}>{
 let stage='avvio'
 const fail=async(error:string,detail:string)=>{await reportFailure({kind:'photo_failed',tenant,phone,detail:stage+': '+detail});return{error}}
 const work=(async():Promise<{url:string}|{error:string}>=>{const {saveImageBuffer,downscaleOversizedImage,passthroughImage}=await import('../lib/image-store.js')
  stage='download';let media:{bytes:Uint8Array,type:string};try{media='bytes' in source?source:await downloadTwilioMedia(source.mediaUrl,process.env.TWILIO_ACCOUNT_SID||'',process.env.TWILIO_AUTH_TOKEN||'')}catch(error){return fail('foto non più scaricabile da WhatsApp',error instanceof Error?error.message:'Error')}
  const problem=photoProblem(media.bytes,media.type);if(problem)return{error:problem.split('\n')[0]!.replace(/\.$/,'')}
  const raw=Buffer.from(media.bytes);let bytes:Buffer
  if(passthroughImage(raw))bytes=raw;else{stage='riduzione';try{bytes=await downscaleOversizedImage(raw,downscaleSourcePixels)}catch(error){return fail('foto troppo grande da elaborare',error instanceof Error?error.message:'Error')}}
  if(!bytes.length)return fail('foto troppo grande da elaborare','riduzione vuota');stage='salvataggio';const saved=await saveImageBuffer(tenant,bytes,{passthrough:true});return 'url' in saved?{url:saved.url}:saved.code==='STORAGE_FULL'?{error:saved.error}:fail(saved.error,saved.code)})().catch(error=>fail('elaborazione della foto non riuscita',error instanceof Error?error.message:'Error'))
 const result=await withTimeout(work,photoTimeoutMs(),null)
 return result??fail('elaborazione della foto troppo lenta','tempo scaduto')
}
const photoRef=(command:any,mediaUrl:string)=>command?.kind==='photo'&&command.mediaUrl===mediaUrl||command?.kind==='batch'&&Array.isArray(command.actions)&&command.actions.some((a:any)=>a?.kind==='image'&&a.mediaUrl===mediaUrl)
const withUrl=(command:any,mediaUrl:string,url:string)=>command.kind==='photo'?{...command,url}:{...command,actions:command.actions.map((a:any)=>a?.kind==='image'&&a.mediaUrl===mediaUrl?{...a,url}:a)}
/** Foto in proposta: elaborata e salvata SUBITO (worker senza pubblicazione), la CONFERMA poi pubblica e basta.
 *  Codec WASM e pubblicazione nello stesso worker edge superavano i limiti del runtime (14/10, Victoria): mai più insieme. */
async function attachPhoto(ctx:Ctx,media:{mediaUrl:string,bytes:Uint8Array,type:string},budget:Budget):Promise<string|null>{
 const open=await db.execute(sql`SELECT command FROM tako_whatsapp_proposals WHERE phone=${ctx.phone} AND expires_at>now()`);if(!photoRef(open[0]?.command,media.mediaUrl))return null
 const saved=await prepareUpload(ctx.tenant,{bytes:media.bytes,type:media.type},ctx.phone);if(budget.expired)return null
 return db.transaction(async tx=>{await lock(tx,ctx.phone);const rows=await tx.execute(sql`SELECT command FROM tako_whatsapp_proposals WHERE phone=${ctx.phone} AND expires_at>now() FOR UPDATE`),command=rows[0]?.command;if(!photoRef(command,media.mediaUrl))return null
  if('error' in saved){await tx.execute(sql`DELETE FROM tako_whatsapp_proposals WHERE phone=${ctx.phone}`);return fill(copy.photoPrepareFailed,{motivo:saved.error.replace(/\.$/,'').toLowerCase()})}
  await tx.execute(sql`UPDATE tako_whatsapp_proposals SET command=${JSON.stringify(withUrl(command,media.mediaUrl,saved.url))}::jsonb WHERE phone=${ctx.phone}`);return null})
}
export async function resolveTurn(ctx:Ctx,text:string,turn:Exclude<Turn,string>,key:string,ai:GroqOptions={},budget:Budget={expired:false}):Promise<string>{
 // 17/10: un avviso del turno deterministico (richiesta in sospeso scartata) arriva anche quando decide l'IA.
 const note='llm' in turn?turn.note:undefined,r=await resolveTurnCore(ctx,text,turn,key,ai,budget);return note&&r?r+'\n\n'+note:r}
async function resolveTurnCore(ctx:Ctx,text:string,turn:Exclude<Turn,string>,key:string,ai:GroqOptions={},budget:Budget={expired:false}):Promise<string>{
 if('upload' in turn){const uploads=new Map<string,string>()
  const byMedia=new Map<string,string>()
  for(const a of turn.upload){const known=byMedia.get(a.mediaUrl);if(known){uploads.set(a.id,known);continue}const saved=await prepareUpload(ctx.tenant,{mediaUrl:a.mediaUrl},ctx.phone)
   if('error' in saved)return fill(copy.photoUploadFailed,{motivo:saved.error.replace(/\.$/,'').toLowerCase()});uploads.set(a.id,saved.url);byMedia.set(a.mediaUrl,saved.url)}
  if(budget.expired)return ''
  try{const done=await turnFor(ctx,'conferma',{uploads,isExpired:()=>budget.expired,beginWrite:()=>beginWrite(budget)});return typeof done==='string'?done:copy.failed}catch{return copy.photoPublishFailed}}
 // PIANO bot-haiku: cervello acceso su haiku → ogni turno di testo all'IA va al cervello Haiku (mai groqMenuPlan, mai Groq).
 const haiku=budget.engine==='haiku'
 if(haiku&&!turn.brain&&!turn.photo&&!turn.fullmenu)turn={...turn,brain:true}
 const brainKey=haiku?engineKey('haiku'):key
 if(!(turn.brain||(haiku&&turn.fullmenu)?brainKey:key))return 'brain' in turn&&turn.brain?copy.brainDown:copy.noAi;const row=await readBotWorkspace(ctx.tenant);if(!row)throw new Error('Workspace missing');const {refs,sections}=catalogOf(workspaceSchema.parse(row.draft))
 if(turn.photo){const candidates=candidatesFor(text,refs);if(!candidates.length)return fill(copy.photoNotFound,{nome:text.slice(0,80)});// PIANO bot-haiku: cervello su Haiku → nessuna chiamata Groq neanche per la foto di un piatto: un solo candidato (o un solo nome
  // identico) = quel piatto, altrimenti si chiede quale (mai una scelta a caso).
  // 22/10 (decisione foto per nome): nomi identici (normalizzati) = lo stesso piatto → foto su tutti, senza domanda; si chiede solo
  // se i candidati hanno nomi DIVERSI.
  const byName=photoTargetsByName(text,candidates,refs),pick:{type:'dish',id:string}|{type:'clarify',ids:string[]}=byName?{type:'dish',id:byName[0]!}:haiku?{type:'clarify',ids:candidates.slice(0,5).map(r=>r.id)}:validateDishPick((await groqDishPick(text,candidates,key,[],ai)).content,refs);if(pick.type==='clarify')return pick.ids.length?fill(copy.photoWhich,{opzioni:bold(pick.ids.map(id=>itemLabel(refs.find(r=>r.id===id)!,refs)))}):fill(copy.photoNotFound,{nome:text.slice(0,80)})
  const targets=byName??groupOf(pick.id,refs)
  if(budget.expired)return '';const done=await turnFor(ctx,text,{isExpired:()=>budget.expired,beginWrite:()=>beginWrite(budget),planned:{revision:row.revision,plan:{type:'change',actions:targets.map(id=>({kind:'image',id,...turn.photo}) as MenuAction)}}});return typeof done==='string'?done:'upload' in done?await resolveTurn(ctx,text,done,key,ai,budget):copy.failed}
 if(turn.fullmenu){let extraction:FullMenuExtraction;try{extraction=haiku?await extractFullMenu(turn.fullmenu.text,brainKey,haikuFullMenuFetcher()):await extractFullMenu(turn.fullmenu.text,key,fullMenuFetcher())}catch(error){if(error instanceof OnboardingBusy)return copy.busy;return fullMenuCopy.failed}
  if(budget.expired)return '';const done=await turnFor(ctx,turn.fullmenu.text,{voice:turn.fullmenu.voice,isExpired:()=>budget.expired,beginWrite:()=>beginWrite(budget),plannedFull:{revision:row.revision,job:turn.fullmenu,extraction}});return typeof done==='string'?done:copy.failed}
 if(turn.text)text=turn.text;const exclude=turn.exclude??[]
 // Fase R: col cervello acceso il turno è tutto del modello (nessuna riserva a regole).
 if(turn.brain)return brainTurnR(ctx,text,brainKey,ai,budget,!!budget.voice).then(r=>{if(process.env.TAKO_BRAIN_DEBUG)void import('node:fs').then(fs=>fs.appendFileSync(String(process.env.TAKO_BRAIN_DEBUG),'R-OUT '+JSON.stringify({expired:budget.expired,r:r.slice(0,200)})+'\n'));return r},e=>{if(process.env.TAKO_BRAIN_DEBUG)void import('node:fs').then(fs=>fs.appendFileSync(String(process.env.TAKO_BRAIN_DEBUG),'R-ERR '+String(e?.stack??e).slice(0,500)+'\n'));throw e})
 const pendingRows=await db.execute(sql`SELECT command,revision FROM tako_whatsapp_proposals WHERE phone=${ctx.phone} AND actor_id=${ctx.actor} AND restaurant_id=${ctx.tenant} AND expires_at>now()`),pendingCommand=pendingRows[0]?.command,pending=storedActions(pendingCommand,refs,sections);
 // Reject oversize requests explicitly rather than applying a truncated transcript/catalog.
 if(text.length>30000||refs.length>1500)return 'La richiesta è *troppo lunga*. Non ho cambiato nulla. Dividila in più messaggi.';
 const candidates=refs,raw=pending?validatePendingMenuPlan((await groqPendingMenuPlan(text,refs,key,sections,pending,ai)).content,refs,sections,text,pending):validateMenuPlan((await groqMenuPlan(text,candidates,key,wantsCreateText(text)?sections:[],ai)).content,refs,{sections,message:text,exclude}),plan:MenuPlan=!candidates.length&&raw.type==='capability'&&!raw.ids.includes('all')&&!looksLikeQuestion(text)?{type:'clarify',ids:[]}:raw;if(budget.expired)return '';const done=await turnFor(ctx,text,{isExpired:()=>budget.expired,beginWrite:()=>beginWrite(budget),planned:{revision:row.revision,plan,proposalRevision:JSON.stringify(pendingCommand??null)},exclude});return typeof done==='string'?done:'upload' in done?await resolveTurn(ctx,text,done,key,ai,budget):copy.notUnderstood
}
// Contatore Groq per giorno (Europe/Rome) e modello; avviso una volta al giorno oltre l'80% di richieste o token/audio.
export const groqLimits:Record<string,{rpd:number,tpd?:number,asd?:number}>={'openai/gpt-oss-120b':{rpd:1000,tpd:200000},'openai/gpt-oss-20b':{rpd:1000,tpd:200000},'whisper-large-v3-turbo':{rpd:2000,asd:28800},
 /** Haiku 5.5 (cervello): nessun limite giornaliero vero, si conta e basta (soglia alta: l'avviso 80% non scatta nell'uso normale). */
 [HAIKU_MODEL]:{rpd:100000}}
const owner=process.env.TAKO_WHATSAPP_USAGE_PHONE||process.env.TAKO_WHATSAPP_ALERT_PHONE||''
export async function recordUsage(e:UsageEvent){try{
 const day=localDate('Europe/Rome').date,rows=await db.execute(sql`INSERT INTO tako_whatsapp_ai_usage(day,model,requests,prompt_tokens,completion_tokens,rate_limited,audio_seconds) VALUES(${day},${e.model},${e.limited?0:1},${e.prompt},${e.completion},${e.limited?1:0},${e.audioSeconds??0}) ON CONFLICT(day,model) DO UPDATE SET requests=tako_whatsapp_ai_usage.requests+EXCLUDED.requests,prompt_tokens=tako_whatsapp_ai_usage.prompt_tokens+EXCLUDED.prompt_tokens,completion_tokens=tako_whatsapp_ai_usage.completion_tokens+EXCLUDED.completion_tokens,rate_limited=tako_whatsapp_ai_usage.rate_limited+EXCLUDED.rate_limited,audio_seconds=tako_whatsapp_ai_usage.audio_seconds+EXCLUDED.audio_seconds RETURNING requests,prompt_tokens,completion_tokens,audio_seconds,warned_at`)
 const row=rows[0],limit=groqLimits[e.model];if(!owner||!row||!limit||row.warned_at)return;const used=[[Number(row.requests)/limit.rpd,`${row.requests}/${limit.rpd} richieste`],...(limit.tpd?[[(Number(row.prompt_tokens)+Number(row.completion_tokens))/limit.tpd,`${Number(row.prompt_tokens)+Number(row.completion_tokens)}/${limit.tpd} token`]]:[]),...(limit.asd?[[Number(row.audio_seconds)/limit.asd,`${Math.round(Number(row.audio_seconds))}/${limit.asd} s audio`]]:[])] as [number,string][]
 const worst=used.sort((a,b)=>b[0]-a[0])[0]!;if(worst[0]<0.8)return
 const claimed=await db.execute(sql`UPDATE tako_whatsapp_ai_usage SET warned_at=now() WHERE day=${day} AND model=${e.model} AND warned_at IS NULL RETURNING model`);if(!claimed.length)return
 const text=fill(copy.usageWarning,{modello:e.model,percento:Math.round(worst[0]*100),uso:worst[1]});console.warn(JSON.stringify({event:'groq_usage_warning',model:e.model,day,ratio:Math.round(worst[0]*100)}))
 const linked=await db.execute(sql`SELECT 1 FROM tako_whatsapp_links WHERE phone=${owner}`);if(linked.length)await sendWhatsApp(process.env.TWILIO_ACCOUNT_SID||'',process.env.TWILIO_AUTH_TOKEN||'',process.env.TWILIO_WHATSAPP_NUMBER||'',owner,text)
}catch(error){console.error(JSON.stringify({event:'groq_usage_record_failed',error:error instanceof Error?error.message.slice(0,80):'Error'}));await reportFailure({kind:'usage_record_failed',detail:error instanceof Error?error.message:'Error'})}}
async function runJob(kind:'audio'|'text'|'image',ctx:Ctx,sid:string,body:string,form:Record<string,string>,lead='',arrivedAt=Date.now()){
 const budget:Budget={expired:false}
 // Fase R: col cervello acceso anche il tempo scaduto è «non disponibile» (unico testo fisso ammesso oltre l'avviso AI Act).
 const brainOn=kind!=='image'&&await readBotBrain(db,ctx.tenant)
 // 21/10: col cervello acceso, un turno che supera i 5 s manda UN solo «Ci sto lavorando…», poi il risultato (i turni veloci niente).
 // 23/10 (chat Luisa): in fila dietro al messaggio precedente dello stesso numero; il «Ci sto lavorando…» conta da quando tocca a lui.
 const turn=await waitTurn(db,ctx.phone,sid,{maxWaitMs:20_000}).catch(()=>({key:null,waitedMs:0})),startAt=turn.waitedMs>500?Date.now():arrivedAt
 let finished=false;const ackTimer=brainOn&&!quietPhones.has(ctx.phone)?setTimeout(()=>{if(finished||budget.expired)return;inBackground(sendWhatsApp(process.env.TWILIO_ACCOUNT_SID||'',process.env.TWILIO_AUTH_TOKEN||'',process.env.TWILIO_WHATSAPP_NUMBER||'',ctx.phone,copy.working).catch(()=>{}))},Math.max(0,5000-(Date.now()-startAt))):undefined
 // notte 22/10: allo scadere, se una scrittura è già partita si aspetta il suo esito (mai «non disponibile» mentre il menu cambia).
 let message=await raceDeadline(jobMessage(kind,ctx,body,form,budget).finally(()=>releaseTurn(db,turn.key)).catch(error=>{if(error instanceof WorkspaceTrialLocked)return error.message;budget.failed=true;return kind==='image'?copy.photoDownload:brainOn?copy.brainDown:copy.failed}),budget,jobTimeoutMs(),()=>kind==='image'?copy.photoTimeout:brainOn?copy.brainDown:copy.jobTimeout).finally(()=>{finished=true;if(ackTimer)clearTimeout(ackTimer)})
 const problem:FailureKind|null=budget.expired?'job_timeout':budget.failed?'job_failed':null
 if(process.env.TAKO_BRAIN_DEBUG)void import('node:fs').then(fs=>fs.appendFileSync(String(process.env.TAKO_BRAIN_DEBUG),'JOB '+JSON.stringify({kind,body:body.slice(0,60),message:String(message).slice(0,120),problem})+'\n'))
 if(!message){if(problem)await reportFailure({kind:problem,tenant:ctx.tenant,phone:ctx.phone,detail:kind});return}if(lead)message=lead+message;const accountSid=process.env.TWILIO_ACCOUNT_SID||'',token=process.env.TWILIO_AUTH_TOKEN||'',from=process.env.TWILIO_WHATSAPP_NUMBER||''
 // 28/10 sera: un messaggio in più parti (PDF del menu: testo, poi l'allegato) parte in invii separati e in ordine, come nel TwiML.
 for(const part of message.split(nextMessage).filter(Boolean)){
  try{await sendWhatsApp(accountSid,token,from,ctx.phone,part)}catch{await new Promise(r=>setTimeout(r,1500));try{await sendWhatsApp(accountSid,token,from,ctx.phone,part)}catch(error){await reportFailure({kind:'send_failed',tenant:ctx.tenant,phone:ctx.phone,detail:error instanceof Error?error.message:'Error'});return}}}
 await db.execute(sql`UPDATE tako_whatsapp_messages SET response=${sent+message} WHERE sid=${sid}`)
 if(problem)await reportFailure({kind:problem,tenant:ctx.tenant,phone:ctx.phone,detail:kind})
}
// 17/10: nomi di piatti e categorie del locale nel `prompt` di Whisper (nessun token LLM in più). Errore → parole di servizio.
async function whisperVocab(tenant:string):Promise<string>{try{const row=await readBotWorkspace(tenant);if(!row)return '';const c=catalogOf(workspaceSchema.parse(row.published??row.draft));return whisperPrompt(c.refs,c.sections)}catch{return ''}}
/** 23/10 (chat Luisa): i messaggi di un numero si lavorano in fila (whatsapp-turn-queue.ts). `turnSid` = biglietto da aspettare (prove
 *  sincrone sul QA); runJob aspetta da sé prima del «Ci sto lavorando…». */
async function jobMessage(kind:'audio'|'text'|'image',ctx:Ctx,body:string,form:Record<string,string>,budget:Budget,turnSid?:string):Promise<string>{
 if(!turnSid)return jobMessageCore(kind,ctx,body,form,budget)
 const turn=await waitTurn(db,ctx.phone,turnSid,{maxWaitMs:20_000,isExpired:()=>budget.expired}).catch(()=>({key:null,waitedMs:0}))
 try{return await jobMessageCore(kind,ctx,body,form,budget)}finally{await releaseTurn(db,turn.key)}}
async function jobMessageCore(kind:'audio'|'text'|'image',ctx:Ctx,body:string,form:Record<string,string>,budget:Budget):Promise<string>{
 const key=process.env.GROQ_API_KEY||'',accountSid=process.env.TWILIO_ACCOUNT_SID||'',token=process.env.TWILIO_AUTH_TOKEN||'';let text=body,prefix='',response:string
 // Fase R: col cervello acceso nessun testo fisso d'attesa né d'errore: solo «non disponibile» (copy.brainDown).
 // Una sola lettura di settings per turno: cervello acceso e motore (haiku|groq).
 const bs=await readBotSettings(db,ctx.tenant),brainOn=kind!=='image'&&bs.brain;if(bs.brain)budget.engine=bs.engine
 const ai:GroqOptions={meter:recordUsage,onWait:()=>quietPhones.has(ctx.phone)||brainOn?undefined:sendWhatsApp(accountSid,token,process.env.TWILIO_WHATSAPP_NUMBER||'',ctx.phone,copy.wait).catch(()=>{})}
 try{if(kind==='image'){if(Number(form.NumMedia)>1)prefix=copy.photoFirstOnly;const media=await downloadTwilioMedia(form.MediaUrl0||'',accountSid,token),problem=photoProblem(media.bytes,media.type||form.MediaContentType0||'');const photo={mediaUrl:form.MediaUrl0||'',mediaType:media.type}
   if(problem)response=problem;else{const turn=await db.transaction(async tx=>{await lock(tx,ctx.phone);const live=await linkedContext(tx,ctx.phone);if(!live)return '';await propose(tx,live,0,{kind:'photo',...photo});return text?menuTurn(tx,live,text,{isExpired:()=>budget.expired,beginWrite:()=>beginWrite(budget)}):copy.photoAsk});response=typeof turn==='string'?turn:await resolveTurn(ctx,text,turn,key,ai,budget);if(response&&!budget.expired)response=await attachPhoto(ctx,{...photo,bytes:media.bytes,type:media.type},budget).catch(async error=>{await reportFailure({kind:'photo_failed',tenant:ctx.tenant,phone:ctx.phone,detail:'allegato: '+(error instanceof Error?error.message:'Error')});return null})??response}}
  else{if(kind==='audio'){if(!key)throw new Error('AI not configured');const [media,vocab]=await Promise.all([downloadTwilioMedia(form.MediaUrl0||'',accountSid,token),whisperVocab(ctx.tenant)]);text=await transcribeAudio(media.bytes,/^audio\//i.test(media.type)?media.type:whatsappAudioType(form.MediaContentType0,form.Body)||media.type,key,ai,vocab)}
   if(kind==='audio'&&!text&&brainOn)text='[vocale senza parole]'
   if(kind==='audio'&&!text)response=copy.voiceEmpty;else{if(kind==='audio'){
    prefix='';
    if(process.env.TAKO_WHATSAPP_ONBOARDING_ENABLED==='1'&&!budget.expired){
     const {onboardingTransport,queueOnboardingChat}=await import('../lib/onboarding-chat.js');const agency=await onboardingTransport(ctx.phone,text);
     if(agency){await queueOnboardingChat(agency.actor,ctx.phone,form.MessageSid!,text,{...form,OnboardingVoice:'1',NumMedia:'0'});return ''}
    }
   }if(budget.expired)return ''
   // 28/10 sera (vocali di Luisa «mandami menù cena da stampare»): testo scritto e trascrizione passano dalla STESSA richiesta di PDF,
   // prima del percorso che modifica i piatti (che con un PDF non deve mai partire).
   const pdf=await db.transaction(tx=>pdfTurn(tx,ctx,text))
   if(pdf)response=pdf
   else{const turn=await turnFor(ctx,text,{voice:kind==='audio',isExpired:()=>budget.expired,beginWrite:()=>beginWrite(budget)});if(kind==='audio')budget.voice=true;response=typeof turn==='string'?turn:await resolveTurn(ctx,text,turn,key,ai,budget)}}}
 }catch(error){if(!(error instanceof GroqBusy))budget.failed=true;response=brainOn&&!(error instanceof WorkspaceTrialLocked)?copy.brainDown:error instanceof GroqBusy?copy.busy:kind==='audio'&&!prefix?copy.voiceFailed:kind==='image'?copy.photoDownload:/^Groq 5\d\d$/.test(String((error as any)?.message??''))?copy.aiDown:copy.failed}
 if(response)response=await resolveLinks(db,ctx,response).catch(()=>response)
 if(response&&kind!=='image'&&!budget.expired)await rememberTurn(db,ctx.tenant,ctx.phone,text,withoutMedia(prefix+response))
 return response?prefix+response:''
}
export async function twilioMenuRoutes(app:FastifyInstance){
 app.get('/menu-workspace/whatsapp',{preHandler:requireRole('owner')},async req=>{const rows=await db.execute(sql`SELECT phone FROM tako_whatsapp_links WHERE restaurant_id=${req.user.restaurantId} AND actor_id=${req.user.id}`);return{data:{configured:!!process.env.TWILIO_AUTH_TOKEN,sender:process.env.TWILIO_WHATSAPP_NUMBER?.replace('whatsapp:','')||null,numbers:rows.map(r=>String(r.phone).replace('whatsapp:',''))}}})
 app.post('/menu-workspace/whatsapp/code',{preHandler:requireRole('owner')},async(req,reply)=>{if(!process.env.TWILIO_AUTH_TOKEN)return reply.code(503).send({error:{message:'Canale Twilio non configurato'}});const code=randomBytes(12).toString('hex');await db.transaction(async tx=>{await tx.execute(sql`DELETE FROM tako_whatsapp_codes WHERE actor_id=${req.user.id} AND restaurant_id=${req.user.restaurantId}`);await tx.execute(sql`INSERT INTO tako_whatsapp_codes(code_hash,restaurant_id,actor_id,expires_at) VALUES(${digest(code)},${req.user.restaurantId},${req.user.id},now()+interval '15 minutes')`)});return{data:{code,sender:process.env.TWILIO_WHATSAPP_NUMBER?.replace('whatsapp:',''),message:'collega tako '+code,expiresInMinutes:15}}})
 app.post('/menu-workspace/whatsapp/disconnect',{preHandler:requireRole('owner')},async req=>{await db.transaction(async tx=>{await tx.execute(sql`DELETE FROM tako_whatsapp_proposals WHERE restaurant_id=${req.user.restaurantId} AND actor_id=${req.user.id}`);await tx.execute(sql`DELETE FROM tako_whatsapp_links WHERE restaurant_id=${req.user.restaurantId} AND actor_id=${req.user.id}`);await tx.execute(sql`DELETE FROM tako_whatsapp_codes WHERE restaurant_id=${req.user.restaurantId} AND actor_id=${req.user.id}`)});return{data:{disconnected:true}}})
 // WhatsApp del titolare (agenzia o titolare del locale, verificato qui). 21/10 (richiesta Manuel): fino a DUE numeri per locale,
 // ognuno con la sua email e il suo account; un telefono = un locale (il telefono è la chiave primaria). Il limite lo verifica il server.
 // Salvare crea un pre-collegamento (activated_at NULL), senza codici né messaggi in uscita; il primo messaggio di quel numero lo attiva.
 // Proposte in sospeso, «ok»/«annulla» e cronologia sono già per telefono (tako_whatsapp_proposals.phone, undo:/last:<telefono>).
 const ownerDenied=(reply:any)=>reply.code(403).send({error:{code:'FORBIDDEN',message:'Solo l\'agenzia o il titolare del locale possono gestire il WhatsApp del titolare.'}})
 const ownerState=async(tx:Tx,tenant:string)=>{const rows=await tx.execute(sql`SELECT phone,activated_at,owner_email FROM tako_whatsapp_links WHERE restaurant_id=${tenant} ORDER BY created_at ASC`)
  const numbers=rows.slice(-OWNER_PHONES_MAX).map(row=>({phone:String(row.phone).replace('whatsapp:',''),email:row.owner_email?String(row.owner_email):null,status:row.activated_at==null?'pending' as const:'linked' as const,activatedAt:row.activated_at?new Date(row.activated_at as string|Date).toISOString():null}))
  // Campi singoli (numero più recente) per i pannelli di prima del 21/10 ancora aperti in qualche browser.
  const last=numbers.at(-1)??null
  return{configured:!!process.env.TWILIO_AUTH_TOKEN,sender:process.env.TWILIO_WHATSAPP_NUMBER?.replace('whatsapp:','')||null,max:OWNER_PHONES_MAX,numbers,email:last?.email??null,phone:last?.phone??null,status:last?.status??null,activatedAt:last?.activatedAt??null}}
 app.get('/menu-workspace/whatsapp/owner',{preHandler:requireRole('owner')},async(req,reply)=>{if(!await permitted(db,req.user.id,req.user.restaurantId))return ownerDenied(reply);return{data:await ownerState(db,req.user.restaurantId)}})
 app.post('/menu-workspace/whatsapp/owner',{preHandler:requireRole('owner')},async(req,reply)=>{
  const input=(req.body??{}) as {phone?:unknown,email?:unknown,move?:unknown,replace?:unknown},e164=normalizeOwnerPhone(input.phone),email=ownerEmailSchema(input.email),tenant=req.user.restaurantId,actor=req.user.id
  if(!e164)return reply.code(400).send({error:{code:'VALIDATION',field:'phone',message:'Numero non valido: scrivi un cellulare italiano, ad esempio 333 123 4567.'}})
  // 19/10: email del titolare obbligatoria: diventa l'utente della sua dashboard (account creato al primo messaggio WhatsApp).
  if(!email)return reply.code(400).send({error:{code:'VALIDATION',field:'email',message:'Email non valida: scrivi l’email del titolare, ad esempio nome@gmail.com.'}})
  const phone=whatsappAddress(e164);if(phone===process.env.TWILIO_WHATSAPP_NUMBER)return reply.code(400).send({error:{code:'VALIDATION',field:'phone',message:'Questo è il numero di Tako: inserisci quello del titolare.'}})
  // 21/10: «Modifica» di una riga con un numero diverso = sostituisce QUEL numero (gli altri restano).
  const replaceE164=input.replace==null||input.replace===''?null:normalizeOwnerPhone(input.replace),replacePhone=replaceE164?whatsappAddress(replaceE164):null
  if(input.replace!=null&&input.replace!==''&&!replaceE164)return reply.code(400).send({error:{code:'VALIDATION',field:'phone',message:'Numero da modificare non valido: ricarica la pagina.'}})
  let result:any
  try{result=await db.transaction(async tx=>{
   if(!await permitted(tx,actor,tenant))return{forbidden:true as const}
   await lock(tx,phone);await lock(tx,'tako-owner-link:'+tenant)
   // L'email non può essere di un altro account (altro locale, agenzia, altro ruolo): l'account del titolare è solo di questo locale.
   const holders=await tx.execute(sql`SELECT id,restaurant_id,role,active FROM users WHERE lower(email)=${email}`)
   if(holders.length&&!(holders.length===1&&holders[0]!.restaurant_id===tenant&&holders[0]!.role==='owner'&&holders[0]!.active===true&&!isAgencyUser(String(holders[0]!.id))))return{emailInUse:true as const}
   const mine=await tx.execute(sql`SELECT phone,owner_email,actor_id FROM tako_whatsapp_links WHERE restaurant_id=${tenant}`)
   const replacing=!!replacePhone&&replacePhone!==phone&&mine.some(l=>String(l.phone)===replacePhone)
   const others=mine.filter(l=>String(l.phone)!==phone&&!(replacing&&String(l.phone)===replacePhone))
   // 21/10: ogni numero ha la SUA email e il suo account: l'email (o l'account) dell'altro numero non si riusa.
   const holder=holders.length===1?String(holders[0]!.id):null
   if(others.some(l=>(l.owner_email&&String(l.owner_email).toLowerCase()===email)||(holder&&String(l.actor_id)===holder&&!isAgencyUser(holder))))return{emailOtherNumber:true as const}
   const rows=await tx.execute(sql`SELECT l.restaurant_id,l.activated_at,l.owner_email,r.name FROM tako_whatsapp_links l JOIN restaurants r ON r.id=l.restaurant_id WHERE l.phone=${phone}`),existing=rows[0]
   if(existing&&String(existing.restaurant_id)===tenant){
    if(replacePhone&&replacePhone!==phone)return{alreadyListed:true as const}
    // 19/10 sera: a collegamento attivo l'email è l'utente con cui il titolare entra già: non si cambia da qui (scollega e ricollega).
    const current=existing.owner_email?String(existing.owner_email):null
    if(existing.activated_at!=null&&current&&current!==email)return{emailLocked:current}
    await tx.execute(sql`UPDATE tako_whatsapp_links SET owner_email=${email} WHERE phone=${phone}`);return{state:await ownerState(tx,tenant)}}
   // 21/10: massimo due numeri per locale; 22/10 (Manuel): tre (il pannello nasconde «Aggiungi numero» a 3 su 3).
   if(others.length>=OWNER_PHONES_MAX)return{limit:true as const}
   if(existing){const other=String(existing.restaurant_id),canMove=await permitted(tx,actor,other);if(input.move!==true||!canMove)return{conflict:{name:canMove?String(existing.name):null,canMove}}}
   // Ricollegamento con l'email di un titolare a cui il bot aveva già consegnato l'accesso: sessioni chiuse ora, password nuova al primo messaggio.
   let reissue=false;if(holder){const prior=await tx.execute(sql`SELECT password_delivered_at FROM users WHERE id=${holder}`)
    if(prior[0]?.password_delivered_at!=null){reissue=true;await tx.execute(sql`DELETE FROM sessions WHERE user_id=${holder}`)}}
   await tx.execute(sql`DELETE FROM tako_whatsapp_proposals WHERE phone=${phone}`)
   await tx.execute(sql`DELETE FROM tako_whatsapp_links WHERE phone=${phone}`)
   if(replacing){await tx.execute(sql`DELETE FROM tako_whatsapp_proposals WHERE phone=${replacePhone}`);await tx.execute(sql`DELETE FROM tako_whatsapp_links WHERE phone=${replacePhone} AND restaurant_id=${tenant}`)}
   await tx.execute(sql`INSERT INTO tako_whatsapp_links(phone,restaurant_id,actor_id,activated_at,owner_email,password_reissue) VALUES(${phone},${tenant},${actor},NULL,${email},${reissue})`)
   return{state:{...await ownerState(tx,tenant),replacedPhones:replacing?[replaceE164]:[]}}})
  }catch(e){
   // Server nuovo su un DB senza la migrazione del 21/10 (indice «un locale = un telefono» ancora presente): errore chiaro, nessun dato toccato.
   const err=e as {constraint_name?:string,message?:string};if(String(err?.constraint_name??err?.message??'').includes('tako_whatsapp_links_one_per_restaurant'))return reply.code(409).send({error:{code:'SECOND_NUMBER_UNAVAILABLE',message:'Il secondo numero non è ancora attivo su questo server. Riprova più tardi o contatta Tako.'}})
   throw e}
  if('forbidden' in result)return ownerDenied(reply)
  if('emailLocked' in result)return reply.code(409).send({error:{code:'EMAIL_LOCKED',field:'email',message:`Il titolare ha già l’accesso con ${result.emailLocked}. Per cambiarla scollega e ricollega.`}})
  if('emailInUse' in result)return reply.code(409).send({error:{code:'EMAIL_IN_USE',field:'email',message:'Questa email è già usata da un altro account. Scrivi un’altra email del titolare.'}})
  if('emailOtherNumber' in result)return reply.code(409).send({error:{code:'EMAIL_OTHER_NUMBER',field:'email',message:'Questa email è già dell’altro numero: ogni numero ha la sua email.'}})
  if('alreadyListed' in result)return reply.code(409).send({error:{code:'PHONE_ALREADY_LISTED',field:'phone',message:'Questo numero è già in elenco.'}})
  if('limit' in result)return reply.code(409).send({error:{code:'OWNER_PHONES_LIMIT',field:'phone',message:'Al massimo quattro numeri per locale. Scollegane uno per aggiungerne un altro.'}})
  if('conflict' in result&&result.conflict){const c=result.conflict;return reply.code(409).send({error:{code:c.canMove?'PHONE_IN_USE_MOVABLE':'PHONE_IN_USE',field:'phone',message:c.canMove?`Questo numero è già collegato a ${c.name}. Vuoi spostarlo su questo locale?`:'Questo numero è già collegato a un altro locale. Per spostarlo contatta Tako.',canMove:c.canMove}})}
  return{data:result.state}})
 // 21/10: scollega UN numero (?phone=…); l'altro resta collegato con proposte e cronologia sue. Senza ?phone vale solo se il locale ne ha uno.
 app.delete('/menu-workspace/whatsapp/owner',{preHandler:requireRole('owner')},async(req,reply)=>{const tenant=req.user.restaurantId,raw=(req.query as {phone?:unknown}|undefined)?.phone
  const e164=raw==null||raw===''?null:normalizeOwnerPhone(raw);if(raw!=null&&raw!==''&&!e164)return reply.code(400).send({error:{code:'VALIDATION',message:'Numero non valido.'}})
  const done=await db.transaction(async tx=>{if(!await permitted(tx,req.user.id,tenant))return'forbidden' as const;await lock(tx,'tako-owner-link:'+tenant)
   const mine=(await tx.execute(sql`SELECT phone FROM tako_whatsapp_links WHERE restaurant_id=${tenant}`)).map(r=>String(r.phone))
   const target=e164?whatsappAddress(e164):mine.length===1?mine[0]!:null
   if(!target){if(mine.length>1)return'which' as const;return'ok' as const}
   if(!mine.includes(target))return'ok' as const
   await tx.execute(sql`DELETE FROM tako_whatsapp_proposals WHERE phone=${target}`)
   await tx.execute(sql`DELETE FROM tako_whatsapp_links WHERE phone=${target} AND restaurant_id=${tenant}`)
   if(mine.length===1)await tx.execute(sql`DELETE FROM tako_whatsapp_codes WHERE restaurant_id=${tenant}`);return'ok' as const})
  if(done==='forbidden')return ownerDenied(reply)
  if(done==='which')return reply.code(400).send({error:{code:'VALIDATION',message:'Indica quale numero scollegare.'}})
  return{data:await ownerState(db,tenant)}})
 app.addContentTypeParser('application/x-www-form-urlencoded',{parseAs:'string'},(_req,body,done)=>{const values=new URLSearchParams(String(body)),form:Record<string,string>={};for(const[k,v]of values){if(k in form)return done(Error('Duplicate form key'));form[k]=v}done(null,form)})
 app.post('/whatsapp/twilio',{bodyLimit:32768},async(req,reply)=>{
 // «Ci sto lavorando…» a 5 s dall'ARRIVO del messaggio (non da dopo lock/DB/lettura impostazioni).
 const arrivedAt=Date.now();
 const form=req.body as Record<string,string>,signature=String(req.headers['x-twilio-signature']||''),endpoint=process.env.TWILIO_WEBHOOK_URL||'';
 // notte 22/10: richiesta arrivata in ritardo (oltre 12 s dal gateway) → le risposte immediate partono via REST, il TwiML resta vuoto.
 const out=(text:string)=>{const r=lateReply(text,{gatewayAt:req.headers['x-tako-gateway-received-at'],arrivedAt,syncTest:form?.TakoSyncTest==='1'});if(!r.send.length)return r.xml
  const job=(async()=>{for(const m of r.send){try{await sendWhatsApp(process.env.TWILIO_ACCOUNT_SID||'',process.env.TWILIO_AUTH_TOKEN||'',process.env.TWILIO_WHATSAPP_NUMBER||'',form.From||'',m)}catch{await new Promise(z=>setTimeout(z,1500));await sendWhatsApp(process.env.TWILIO_ACCOUNT_SID||'',process.env.TWILIO_AUTH_TOKEN||'',process.env.TWILIO_WHATSAPP_NUMBER||'',form.From||'',m).catch(()=>{})}}})(),runtime=(globalThis as any).EdgeRuntime
  if(typeof runtime?.waitUntil==='function')runtime.waitUntil(job);else void job;return r.xml}
 if(req.url!=='/api/whatsapp/twilio'||!form||!validTwilioSignature(process.env.TWILIO_AUTH_TOKEN||'',endpoint,form,signature)||form.AccountSid!==process.env.TWILIO_ACCOUNT_SID||form.To!==process.env.TWILIO_WHATSAPP_NUMBER)return reply.code(403).send('Forbidden');
 // Owner invitation is a separate trust boundary: validate the signed envelope before consuming it,
 // and never forward activation tokens to another service. Helper owns its DB transaction.
 if(/^attiva takomenu\b/i.test(form.Body||'')){
  if(!/^whatsapp:\+\d{8,15}$/.test(form.From||'')||!/^(?:SM|MM)[a-f0-9]{32}$/i.test(form.MessageSid||''))return reply.code(400).send('Invalid message');
  const cached=await db.execute(sql`SELECT response FROM tako_whatsapp_messages WHERE sid=${form.MessageSid}`);if(cached.length)return reply.type('text/xml; charset=utf-8').send(twiml(String(cached[0]!.response)));
  const {activateOwnerInvite}=await import('../lib/onboarding-owner-invite.js');const messages=await activateOwnerInvite(form.From!,form.Body||'');const text=(messages??['L’invito *non è valido*. Chiedi un nuovo link alla tua agenzia.']).join(nextMessage);
  const response=await db.transaction(async tx=>{await lock(tx,form.From!);const duplicate=await tx.execute(sql`SELECT response FROM tako_whatsapp_messages WHERE sid=${form.MessageSid}`);if(duplicate.length)return String(duplicate[0]!.response);await tx.execute(sql`INSERT INTO tako_whatsapp_messages(sid,response) VALUES(${form.MessageSid},${text}) ON CONFLICT DO NOTHING`);return text});
  return reply.type('text/xml; charset=utf-8').header('Cache-Control','no-store').send(out(response));
 }
 const lifecycleCommand=/^(?:avvia|riprendi) onboarding\b/i.test(form.Body||'');
 if(lifecycleCommand&&process.env.TAKO_WHATSAPP_ONBOARDING_ENABLED!=='1')return reply.type('text/xml; charset=utf-8').header('Cache-Control','no-store').send(out('Il collegamento *non è disponibile*. Generane uno nuovo dalla dashboard agenzia.'));
 if(process.env.TAKO_WHATSAPP_ONBOARDING_ENABLED==='1'&&/^whatsapp:\+\d{8,15}$/.test(form.From||'')&&/^(?:SM|MM)[a-f0-9]{32}$/i.test(form.MessageSid||'')&&(form.Body||'').length<=2000){
  const {onboardingTransport,queueOnboardingChat,expiredOnboardingNotice,startsOnboarding}=await import('../lib/onboarding-chat.js');const pair=/^collega agenzia\b/i.test(form.Body||'');
  if(pair){const prior=await db.execute(sql`SELECT response FROM tako_whatsapp_messages WHERE sid=${form.MessageSid}`);if(prior.length)return reply.type('text/xml; charset=utf-8').send(twiml(String(prior[0]!.response)))}
  const agencyOnlyVoice=!!whatsappAudioType(form.MediaContentType0,form.Body)&&!(await db.execute(sql`SELECT 1 FROM tako_whatsapp_links WHERE phone=${form.From!}`)).length;
  const agency=await onboardingTransport(form.From!,form.Body||'',agencyOnlyVoice);
  // The answer always arrives by REST from the queue. The immediate TwiML ack is only for a brand-new draft;
  // acking every step made each reply look doubled («Sto preparando il nuovo locale» after a name or a vocal).
  if(agency){const fresh=!agency.active&&(startsOnboarding(form.Body||'')||/^avvia onboarding\b/i.test(form.Body||'')),queued=await queueOnboardingChat(agency.actor,form.From!,form.MessageSid!,form.Body||'',form);return reply.type('text/xml; charset=utf-8').header('Cache-Control','no-store').send(out(queued&&fresh?'Sto preparando il *nuovo locale*. Resta privato fino alla tua approvazione.':''))}
  // A draft that just expired must not turn its follow-ups (LOGO:, a menu vocal) into edits of a real restaurant.
  if(!lifecycleCommand&&!pair){const notice=await expiredOnboardingNotice(form.From!,form.Body||'',form);if(notice!==null&&typeof notice==='object'){await queueOnboardingChat(notice.voiceActor,form.From!,form.MessageSid!,form.Body||'',form);return reply.type('text/xml; charset=utf-8').header('Cache-Control','no-store').send(twiml(''))}if(notice!==null)return reply.type('text/xml; charset=utf-8').header('Cache-Control','no-store').send(out(notice))}
  if(lifecycleCommand)return reply.type('text/xml; charset=utf-8').header('Cache-Control','no-store').send(out('Il collegamento è *scaduto o non valido* per questo numero. Genera un nuovo QR dalla dashboard agenzia.'));
  if(pair)return reply.type('text/xml; charset=utf-8').header('Cache-Control','no-store').send(out('Il collegamento agenzia è *scaduto o non valido*. Generane uno nuovo dalla dashboard agenzia.'))
 }
 if(lifecycleCommand)return reply.code(400).send('Invalid onboarding message');
 const linked=await db.execute(sql`SELECT 1 FROM tako_whatsapp_links WHERE phone=${form.From||''}`);if(!shouldHandleInTako(linked.length>0,form.Body||''))try{const forwarded=await forwardTwilioWebhook(process.env.MENUSMART_WHATSAPP_WEBHOOK_URL||menusmartWebhook,process.env.TWILIO_AUTH_TOKEN||'',form);if(forwarded.contentType)reply.header('Content-Type',forwarded.contentType);return reply.code(forwarded.status).send(forwarded.body)}catch(error){req.log.error({error:error instanceof Error?error.name:'Error'},'MenuSmart WhatsApp forward failed');await inBackground(reportFailure({kind:'menusmart_forward',detail:error instanceof Error?error.name:'Error'}));return reply.type('text/xml; charset=utf-8').header('Cache-Control','no-store').send(twiml(''))}
 const phone=form.From||'',sid=form.MessageSid||'',body=(form.Body||'').trim(),media=Number(form.NumMedia||0);if(form.TakoSyncTest==='1'){quietPhones.add(phone);setTimeout(()=>quietPhones.delete(phone),120000)}if(!/^whatsapp:\+\d{8,15}$/.test(phone)||!(/^SM[a-f0-9]{32}$/i.test(sid)||linked.length>0&&/^MM[a-f0-9]{32}$/i.test(sid)))return reply.code(400).send('Invalid message');
 // 28/10 sera (audit): un messaggio lunghissimo riceveva un errore muto; ora una risposta che spiega cosa fare
 if(body.length>2000)return reply.type('text/xml; charset=utf-8').header('Cache-Control','no-store').send(twiml(linked.length?'Il messaggio è troppo lungo per me. Mandamelo in due o tre pezzi più corti, per esempio un sottomenu alla volta.':''));
 const scope:{tenant?:string,cached?:boolean}={};const result=await db.transaction(async tx=>{await lock(tx,phone);const cached=await tx.execute(sql`SELECT response FROM tako_whatsapp_messages WHERE sid=${sid}`);if(cached.length){scope.cached=true;const text=String(cached[0]!.response);return text.startsWith(sent)?'':text}
 const answer=async(text:string)=>{await tx.execute(sql`INSERT INTO tako_whatsapp_messages(sid,response) VALUES(${sid},${text}) ON CONFLICT DO NOTHING`);return text};
 const pair=body.match(/^collega tako ([a-f0-9]{24})$/i);if(pair){const codes=await tx.execute(sql`DELETE FROM tako_whatsapp_codes WHERE code_hash=${digest(pair[1]!.toLowerCase())} AND expires_at>now() RETURNING restaurant_id,actor_id`);const code=codes[0];if(!code||!await permitted(tx,String(code.actor_id),String(code.restaurant_id)))return answer(copy.codeInvalid);await lock(tx,'tako-owner-link:'+String(code.restaurant_id))
  // 21/10: il codice aggiunge il numero accanto a quelli già collegati, fino a due per locale (prima sostituiva tutti).
  const otherLinks=await tx.execute(sql`SELECT phone FROM tako_whatsapp_links WHERE restaurant_id=${code.restaurant_id} AND phone<>${phone}`);if(otherLinks.length>=OWNER_PHONES_MAX)return answer(copy.pairLimit)
  await tx.execute(sql`DELETE FROM tako_whatsapp_proposals WHERE phone=${phone}`);await tx.execute(sql`INSERT INTO tako_whatsapp_links(phone,restaurant_id,actor_id,activated_at) VALUES(${phone},${code.restaurant_id},${code.actor_id},now()) ON CONFLICT(phone) DO UPDATE SET restaurant_id=EXCLUDED.restaurant_id,actor_id=EXCLUDED.actor_id,created_at=now(),activated_at=now()`);await discloseOnce(tx,phone);return answer(await welcomeFor(tx,String(code.restaurant_id)))}
 const ctx=await linkedContext(tx,phone);if(!ctx)return answer('');scope.tenant=ctx.tenant
 // Primo messaggio di un numero pre-collegato dalla dashboard: qualunque cosa scriva, si attiva e riceve il benvenuto (una volta: activated_at).
 // 19/10: niente «cosa sai fare» automatico, il benvenuto invita a chiederlo.
 // 19/10 (richiesta Manuel): il benvenuto parte da «Ciao! Sono Takomenu…», senza la riga «assistente automatico» (vale anche per «collega tako»).
 // Il numero resta segnato in `ai:` così la riga non compare in testa alla risposta successiva; resta la risposta a «sei un bot?» (botQuestion).
 // 19/10: dopo il benvenuto, in background e una volta sola (activated_at), dashboard con credenziali e menu digitale (activationFollowUps).
 // 19/10 sera: se il primo messaggio è un vocale o una foto, dopo benvenuto e messaggi di accesso si lavora anche quello (job con chiave propria).
 if(ctx.pending){await tx.execute(sql`UPDATE tako_whatsapp_links SET activated_at=now() WHERE phone=${phone} AND activated_at IS NULL`);await tx.execute(sql`DELETE FROM tako_whatsapp_proposals WHERE phone=${phone}`);await discloseOnce(tx,phone)
  const welcome=await answer(await welcomeFor(tx,ctx.tenant)),type=form.MediaContentType0||'',mediaJob=media>0?(whatsappAudioType(type,body)?'audio' as const:/^image\//i.test(type)?'image' as const:null):null
  if(mediaJob){const key=sid+':media';await reserve(tx,key);await enqueueTurn(tx,phone,key);return{kind:'activated' as const,say:welcome,ctx,media:{job:mediaJob,key}}}
  return{kind:'activated' as const,say:welcome,ctx}}
 if(phone===testFaultPhone&&ctx.tenant===qaTenant&&normalizeMenuText(body)==='guasto di prova')throw new TestFault('Guasto simulato')
 // AI Act (17/10): al primo messaggio di un numero già collegato, una riga «assistente automatico», una volta sola.
 const disclose=await discloseOnce(tx,phone),say=async(t:string)=>{t=await resolveLinks(tx,ctx,t);return answer(disclose&&t?copy.aiDisclosure+'\n\n'+t:t)},prefix=disclose?copy.aiDisclosure+'\n\n':''
 // 19/10 (richiesta Manuel): «sei un bot?» / «sei una persona?» → la riga «assistente automatico», una volta sola anche al primo messaggio.
 if(media===0&&botQuestion(body))return answer(copy.aiDisclosure)
 // 19/10: link della dashboard / del menu digitale. Le credenziali (account creato ora) partono a parte (REST), mai nel TwiML in cache.
 // 28/10 sera (chat di Luisa 19:03): con messaggi dello stesso numero ancora in lavorazione il PDF va in fila (risposta e PDF dopo le
 // modifiche chieste prima, mai un PDF del menu di prima davanti alla loro conferma). Lo serve il job (jobMessageCore → pdfTurn).
 if(media===0){const pdf=await pdfTurn(tx,ctx,body);if(pdf){if(!await turnsBusy(tx,phone))return say(pdf);await reserve(tx,sid);await enqueueTurn(tx,phone,sid);return{job:'text' as const,ctx,ack:'',prefix}}}
 if(media===0){const link=await linkTurn(tx,ctx,body);if(link){if(link.secret)return{kind:'secret' as const,say:await say(link.say),secret:[(link.say||!disclose?'':copy.aiDisclosure+'\n\n')+link.secret],ctx,...(link.deliver?{deliver:link.deliver}:{})};return say(link.say)}}
 if(media>0){const type=form.MediaContentType0||'',job=whatsappAudioType(type,body)?'audio' as const:/^image\//i.test(type)?'image' as const:null;if(!job)return say(copy.mediaOnly);await reserve(tx,sid);await enqueueTurn(tx,phone,sid);return{job,ctx,ack:'',prefix}}
 if(!body&&!(await readBotBrain(tx,ctx.tenant)))return say(copy.help);const turn=await menuTurn(tx,ctx,body);if(typeof turn==='string')return say(turn);if('llm' in turn&&!aiKeyFor(turn,await readBotSettings(tx,ctx.tenant)))return say((turn as any).brain?copy.brainDown:copy.noAi);await reserve(tx,sid);await enqueueTurn(tx,phone,sid);return{job:'text' as const,ctx,ack:'upload' in turn?prefix+copy.photoWorking:'',prefix:'upload' in turn?'':prefix}}).catch(async error=>{if(error instanceof WorkspaceTrialLocked)return error.message;req.log.error({error:error instanceof Error?error.message.slice(0,80):'Error'},'WhatsApp turn failed');await inBackground(reportFailure({kind:error instanceof TestFault?'test_fault':'webhook_error',tenant:scope.tenant??null,phone,detail:error instanceof Error?error.message:'Error'}));return copy.failed});
 if(typeof result==='string'){if(scope.tenant&&!scope.cached&&result&&body)await rememberTurn(db,scope.tenant,phone,body,withoutMedia(result));return reply.type('text/xml; charset=utf-8').header('Cache-Control','no-store').send(scope.cached?twiml(result):out(result))}
 // 19/10: messaggi riservati (credenziali) e messaggi dopo l'attivazione: via REST, in ordine, con una breve pausa dopo la risposta.
 // Verifica dal vivo sincrona sul QA (TakoSyncTest): tutto nello stesso TwiML, niente REST.
 if('kind' in result){const r=result as Secret,sync=r.ctx.tenant===qaTenant&&form.TakoSyncTest==='1'
  if(r.say&&body)await rememberTurn(db,r.ctx.tenant,phone,body,r.say)
  const extra=():Promise<FollowUps>=>r.kind==='activated'?activationFollowUps(r.ctx):Promise.resolve({messages:r.secret,...(r.deliver?{deliver:r.deliver}:{})}),mediaJob=r.kind==='activated'?r.media:undefined
  if(sync){const out=await extra();if(out.deliver)await markPasswordDelivered(db,r.ctx,out.deliver);const m=mediaJob?await jobMessage(mediaJob.job,r.ctx,body,form,{expired:false},mediaJob.key).catch(()=>copy.failed):'';if(mediaJob)await db.execute(sql`UPDATE tako_whatsapp_messages SET response=${sent+m} WHERE sid=${mediaJob.key}`);return reply.type('text/xml; charset=utf-8').header('Cache-Control','no-store').send(twiml([r.say,...out.messages,m].filter(Boolean).join(nextMessage)))}
  const job=extra().then(m=>sendSecrets(r.ctx,m,!!r.say)).catch(error=>req.log.error({error:error instanceof Error?error.message.slice(0,80):'Error'},'WhatsApp follow-up failed')).then(()=>mediaJob&&runJob(mediaJob.job,r.ctx,mediaJob.key,body,form,'')).catch(error=>req.log.error({error:error instanceof Error?error.message.slice(0,80):'Error'},'WhatsApp AI job failed')),runtime=(globalThis as any).EdgeRuntime;if(typeof runtime?.waitUntil==='function')runtime.waitUntil(job);else await job
  return reply.type('text/xml; charset=utf-8').header('Cache-Control','no-store').send(out(r.say))}
 // Verifica dal vivo sincrona: solo sul QA e solo con il campo firmato TakoSyncTest=1 (la firma Twilio copre tutti i campi: serve il
 // token). Anche le risposte dell'IA tornano SOLO nel TwiML di questa richiesta, mai via REST, e senza avvisi. Altrimenti nulla cambia.
 if(result.ctx.tenant===qaTenant&&form.TakoSyncTest==='1'){const m=await jobMessage(result.job,result.ctx,body,form,{expired:false},sid).catch(()=>copy.failed);await db.execute(sql`UPDATE tako_whatsapp_messages SET response=${sent+m} WHERE sid=${sid}`);return reply.type('text/xml; charset=utf-8').header('Cache-Control','no-store').send(twiml((result.ack?result.ack+'\n\n':'')+(m?result.prefix+m:'')))}
 const job=runJob(result.job,result.ctx,sid,body,form,result.prefix,arrivedAt).catch(error=>req.log.error({error:error instanceof Error?error.message.slice(0,80):'Error'},'WhatsApp AI job failed')),runtime=(globalThis as any).EdgeRuntime;if(typeof runtime?.waitUntil==='function')runtime.waitUntil(job);else await job
 return reply.type('text/xml; charset=utf-8').header('Cache-Control','no-store').send(out(result.ack))
 })
}

/** Riepilogo della struttura (motore haiku, decisione Manuel 21/10): Menu e Sottomenu nuovi nascono nascosti; «rendi visibile X» li mostra. */
function structureReply(actions:MenuAction[],refs:MenuRef[],sections:SectionRef[],hiddenMenus?:Set<string>):string{
 const out:string[]=[],list=(xs:string[])=>xs.map(x=>'*'+safe(x)+'*').join(', ')
 const newMenus=actions.filter(a=>a.kind==='create_menu') as Extract<MenuAction,{kind:'create_menu'}>[]
 const secs=actions.filter(a=>a.kind==='create_section') as Extract<MenuAction,{kind:'create_section'}>[]
 for(const m of newMenus){const inside=secs.filter(x=>x.menuId===m.newMenuId&&!x.parentSectionId).map(x=>x.name)
  out.push('Ho creato il Menu *'+safe(m.name)+'*'+(inside.length?(inside.length===1?' con il sottomenu ':' con i sottomenu ')+list(inside):'')+'. Per ora è nascosto: scrivi *rendi visibile '+safe(m.name)+'* quando vuoi che i clienti lo vedano.')}
 // Il testo segue il dato: «nascosto» solo per i sottomenu creati nascosti (in un Menu nascosto il sottomenu resta visibile e lo governa il Menu).
 const byMenu=new Map<string,{names:string[],hidden:boolean}>();for(const x of secs)if(!x.parentSectionId&&!newMenus.some(m=>m.newMenuId===x.menuId)){const k=(x.menuName??'')+'\u0000'+((x as any).hidden?1:0),g=byMenu.get(k)??{names:[],hidden:!!(x as any).hidden};g.names.push(x.name);byMenu.set(k,g)}
 for(const [k,{names,hidden}] of byMenu){const menu=k.split('\u0000')[0]!;out.push((names.length===1?'Ho creato il sottomenu ':'Ho creato i sottomenu ')+list(names)+(menu?' nel Menu *'+safe(menu)+'*':'')+(hidden?'. Per ora '+(names.length===1?'è nascosto':'sono nascosti')+': scrivi *rendi visibile '+safe(names[0]!)+'* quando vuoi che i clienti '+(names.length===1?'lo vedano':'li vedano')+'.':!hiddenMenus||hiddenMenus.has(menu)?'. I clienti '+(names.length===1?'lo vedranno':'li vedranno')+' quando renderai visibile il Menu.':'.'))}
 for(const x of secs)if(x.parentSectionId)out.push('Ho creato la Sezione *'+safe(x.name)+'* in *'+safe(x.parentName??'')+'*.')
 for(const a of actions){if(a.kind==='set_menu_active'||a.kind==='set_section_active'){const what=(a.kind==='set_menu_active'?'il Menu *':'il sottomenu *')+safe(a.name)+'*'
   out.push(a.value?'Fatto: '+what+' ora è visibile ai clienti.'+(a.items?'':' I clienti vedono «Menu in arrivo» finché non aggiungi i piatti.'):'Fatto: '+what+' ora è nascosto ai clienti.')}
  if(a.kind==='delete_menu'||a.kind==='delete_section'||a.kind==='set_formula'||a.kind==='delete_formula'||a.kind==='set_menu_pricing')out.push(describeAction(a,refs,sections)+'.')}
 return out.join(out.length>2?'\n\n':'\n')
}
// 22/10: più voci non salvate → una per riga (prima «a; b; c» su una riga).
const unsavedText=(xs:string[])=>xs.length>1?'Non salvato:\n'+xs.map(x=>'• '+x).join('\n'):'Non salvato: '+xs[0]

/** 22/10 notte (decisione Manuel «eliminare, non nascondere»): la bozza del modello non dice mai che un PIATTO è «nascosto» (i piatti tolti
 * sono eliminati; i fatti del server lo dicono). Restano le frasi sulla visibilità di Menu/Sottomenu quando il turno la cambia davvero. */
export function noHiddenTalk(d:string,acts:MenuAction[]):string|null{
 if(acts.some(a=>a.kind==='set_menu_active'||a.kind==='set_section_active'||(a.kind==='create_section'&&(a as any).hidden)||a.kind==='create_menu'))return d
 const keep=d.split(/(?<=[.!?])\s+/).filter(x=>!/\b(?:nascost\w*|nascond\w*)\b/i.test(x));return keep.join(' ').trim()||null}
/** Riepilogo della sostituzione giornaliera (menu a prezzo fisso): per sottomenu, i piatti di oggi; in fondo gli eliminati (22/10 notte). */
export function replaceReply(actions:MenuAction[],refs:MenuRef[],sections:SectionRef[],extra=''):string{
 const bySec=new Map<string,{shown:string[],hidden:string[]}>(),get=(id:string)=>{let v=bySec.get(id);if(!v){v={shown:[],hidden:[]};bySec.set(id,v)}return v}
 for(const a of actions as any[]){if(a.kind==='create')get(a.sectionId).shown.push(a.name);else if(a.kind==='delete'){const r=refs.find(x=>x.id===a.id);if(r)get(r.sectionId??'').hidden.push(r.name)}else if(a.kind==='hidden'){const r=refs.find(x=>x.id===a.id);if(!r)continue;(a.value?get(r.sectionId??'').hidden:get(r.sectionId??'').shown).push(r.name)}}
 for(const r of refs){const v=bySec.get(r.sectionId??'');if(v&&!r.hidden&&!(actions as any[]).some(a=>a.id===r.id&&(a.kind==='delete'||a.kind==='hidden'))&&!v.shown.includes(r.name))v.shown.push(r.name)}
 // 22/10 (richiesta Manuel, screenshot Victoria): messaggio strutturato, non un blocco unico. Per Menu un titolo in grassetto, per
 // sottomenu il nome in grassetto e un piatto per riga; gli eliminati in fondo su una riga sola; righe vuote tra i blocchi.
 const byMenu=new Map<string,string[]>(),hidden:string[]=[]
 for(const [id,v] of bySec){const s=sections.find(x=>x.id===id),menu=(s?.menu??'').trim(),blocks=byMenu.get(menu)??[]
  blocks.push('*'+safe(s?.name??'')+'*\n'+(v.shown.length?v.shown.map(x=>'• '+safe(x)).join('\n'):'• nessun piatto'));byMenu.set(menu,blocks)
  for(const h of v.hidden)if(!hidden.includes(h))hidden.push(h)}
 const out:string[]=[]
 for(const [menu,blocks] of byMenu)out.push('*'+(menu?(/^men[uù]\b/i.test(menu)?safe(menu):'Menu '+safe(menu)):'Menu')+' aggiornato*',...blocks)
 if(hidden.length)out.push('Eliminati: '+hidden.map(safe).join(', '))
 if(extra)out.push(extra)
 return out.join('\n\n')+'\n\nPer tornare come prima scrivi *annulla* entro 10 minuti.'
}

/** notte 22/10: il nome di un piatto NUOVO detto con «aggiungi / inserisci / metti nel menu» («aggiungi le patatine fritte a 4 nei primi» →
 * «patatine fritte»), solo se non è già un piatto del menu. null = nessun nome chiaro. */
function newDishName(text:string,refs:MenuRef[]):string|null{const m=text.replace(/[🎤]/gu,' ').match(/\b(?:aggiungi|aggiungere|aggiungiamo|inserisci|inserire|metti(?:mi)? anche)\s+(?:anche\s+)?(?:(?:il|lo|la|i|gli|le|un|una|uno)\s+|l['’]\s*)?(.+?)\s*(?:(?:\s(?:a|da|al prezzo di)\s+\d.*)|(?:\s(?:nei|nelle|negli|nel|nella|tra|fra|in|sotto|dentro)\s.*))?[.!?]*$/i);if(!m)return null
 const n=m[1]!.replace(/\s+(?:a|per)\s*$/i,'').trim();if(!n||n.split(' ').length>5||/\d/.test(n)||/\b(?:sottomenu|menu|sezione|categoria|prezzo|piatto|piatti|opzion\w*|formul\w*|complet\w*|fisso)\b/i.test(n))return null
 if(refs.some(r=>sameDishName(r.name,n)))return null
 return n.charAt(0).toLocaleUpperCase('it')+n.slice(1)}
// fase 3: azione di un comando col pronome sul piatto di riferimento (prezzo, differenza, finito/tornato, nascondi/rimetti).
function pronounAct(one:MenuRef,vtext:string):MenuAction|null{const p2=plain(vtext),rd=relativeDelta(vtext),gp=[...new Set(g9Prices(vtext).map(x=>Math.round(x*100)/100))],sp0=singlePrice(vtext),sp=sp0!==null&&sp0>0?sp0:/\d/.test(vtext)&&gp.length===1?gp[0]!:null // fase 3: «mettila a 10» → g9Prices [10, 10.1]: vale il prezzo unico detto
  return rd?{kind:'price',id:one.id,price:Math.round((one.price+rd.delta)*100)/100} as MenuAction:sp!==null&&sp>0&&!/\b(?:alz|abbass|aument|diminu|scont)\w*/.test(p2)?{kind:'price',id:one.id,price:sp} as MenuAction:/\b(?:finit\w*|esaurit\w*)\b/.test(p2)&&!/\b(?:non|nun)\b/.test(p2)?{kind:'available',id:one.id,value:false} as MenuAction:/\b(?:nascond\w*|togli\w*|lev[ai]\w*)\b/.test(p2)&&!/\b(?:non|nun)\b/.test(p2)?{kind:'hidden',id:one.id,value:true} as MenuAction:/\b(?:tornat\w*|disponibil\w*)\b/.test(p2)&&!/\b(?:non|nun)\b/.test(p2)?{kind:'available',id:one.id,value:true} as MenuAction:/\brimett\w*\b/.test(p2)&&one.hidden?{kind:'hidden',id:one.id,value:false} as MenuAction:null}
