import {mergeOnboardingRows,onboardingDisplayCase,type OnboardingChoice} from './onboarding-menu-merge.js'
import {recordOnboardingFailure} from './onboarding-failure.js'
import {onboardingAssetRole,onboardingHasPrice} from './onboarding-asset-role.js'
import {applyOnboardingDesign} from './onboarding-design.js'
import {agencyStartActor,onboardingLifecycleCommand,redeemAgencyOnboardingCode,touchOnboardingActivity,purgeExpiredOnboarding} from './onboarding-lifecycle.js'
import {createOwnerInvite,sendOwnerInviteQr} from './onboarding-owner-invite.js'
import {randomBytes,createHash,randomUUID} from 'node:crypto'
import {db} from '@tako/db'
import {sql} from 'drizzle-orm'
import {isAgencyUser} from './agency-access.js'
import {workspaceSchema} from './menu-workspace-contract.js'
import {menuLayoutDefaults} from './menu-layout-defaults.js'
import {normalizeOwnerPhone} from './whatsapp-phone.js'
import {createOnboarding,activeOnboarding,getOnboarding,updateOnboarding,cancelOnboarding,approveOnboarding,listOnboarding,type OnboardingSession,type OnboardingData} from './onboarding-store.js'
import {ingestOnboardingSource,inspectOnboardingMedia,type OnboardingSource} from './onboarding-source.js'
import {extractOnboardingMessage,extractOnboardingMenu} from './onboarding-planner.js'
import {onboardingUncoveredClauses,onboardingNonPriceRequests} from './onboarding-clauses.js'
import {mentionsOnboardingDish} from './onboarding-dish-name.js'
import {ocrOnboardingImage,ocrOnboardingPdf} from './onboarding-ocr.js'
import {downloadTwilioMedia,sendWhatsApp,transcribeAudio} from './twilio-menu-ai.js'
import {whatsappAudioType} from './twilio-menu-command.js'
export {whatsappAudioType}
import {translateWorkspace,groqTranslationProviderFor} from './menu-workspace-translate.js'
import {classifyOnboardingTranslationFailure,OnboardingTranslationFailure,shouldRetryOnboardingTranslation,onboardingTranslationRetries,onboardingRetryDelayMs} from './onboarding-translation-retry.js'
import {foodCatalogs} from './menu-workspace-catalogs.js'
import {dispatchOnboardingJob} from './onboarding-dispatch.js'
import {stageOnboardingImage,generateOnboardingHero} from './onboarding-assets.js'
import {guardedFetch,isChromatic} from './site-brand.js'
import {COMMON_MENU_LANGUAGES} from './menu-workspace-languages.js'
export const onboardingHash=(text:string)=>createHash('sha256').update(text).digest('hex')
const token=()=>randomBytes(32).toString('hex')
const origin='https://takoitalia.com'
export const onboardingCommand=(text:string)=>text.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim()
export const startsOnboarding=(text:string)=>/^(?:crea|nuovo|nuova|inserisci|aggiungi|onboarding)(?: un| una| il)?(?: nuov[oa])? (?:local[ei]|client[ei]|ristorant[ei])\b/i.test(text.trim())||/^onboarding(?:\s|$)/i.test(text.trim())
/** Words that end the locale name inside a longer creation message (typed or transcribed without punctuation). */
const nameStop=/\s+(?:crea|creare|aggiungi|inserisci|metti|imposta|con (?:il|i|un|una|la|le|lo) (?:menu|menù)|nel (?:menu|menù)|(?:il |un |una )?(?:menu|menù)\b|categoria|titolare|non pubblicare)(?=\s|$)[\s\S]*$/i
/** Lower-case answers (typed fast or transcribed) become a readable name; mixed case is kept as written. */
export const onboardingDisplayName=(text:string)=>text===text.toLowerCase()?text.split(' ').map(w=>w?w[0]!.toUpperCase()+w.slice(1):w).join(' '):text
/** A short explicit creation command is itself grounded evidence of the locale name, also when followed by menu sentences. */
export function onboardingCreationName(text:string):string|null{
 const match=text.trim().match(/^(?:crea|inserisci|aggiungi)(?: un| una| il)?(?: nuov[oa])? (?:local[ei]|client[ei]|ristorant[ei])\s+(.+)$/is)
 let name=match?.[1]?.trim().split(/[.;,!?\n\r]/)[0]!.replace(nameStop,'').replace(/^(?:chiamat[oa]|di nome|che si chiama|nome)\s+/i,'').trim()
 if(!name||name.length>80||name.split(/\s+/).length>8||/[@:/]|https?\b|\b(?:telefono|email|mail|titolare|sito|menu|menù)\b|\d{5}/i.test(name))return null
 return onboardingDisplayName(name)
}
type StepField='name'|'ownerName'|'ownerPhone'|'ownerEmail'|'slug'
/** The field the bot is currently asking for, in the same order as nextOnboardingStep. */
export function expectedOnboardingField(d:OnboardingData):StepField|null{
 if(!d.name)return 'name'
 if(pendingOnboardingSources(d)||!d.workspace.menus.some(m=>m.sections.some(section=>section.items.length))||d.unresolved.length)return null
 if(!d.ownerName)return 'ownerName'
 if(!d.ownerPhone)return 'ownerPhone'
 if(!d.ownerEmail)return 'ownerEmail'
 if(!d.slug||reservedOnboardingSlug(d.slug))return 'slug'
 return null
}
const notAnAnswer=/^(?:cambia|aggiungi|metti|togli|rimuovi|modifica|crea|imposta|usa|voglio|vorrei|puoi|fai|elimina|sposta|nascondi|mostra|correggi|aggiorna|porta|annulla|esci|riprendi|approva|prepara|stato|elenco|anteprima|invito|verificato|ok|si|sì|no|grazie|ciao)\b|\b(?:menu|menù|categoria|prezzo|colore|sfondo|font|logo|copertina|piatt[oi]|pubblica)\b/i
/** A plain reply to the question just asked is accepted deterministically, without the AI extractor. */
export function onboardingStepAnswer(d:OnboardingData,text:string):Partial<Record<StepField,string>>|null{
 const field=expectedOnboardingField(d),raw=text.trim().replace(/\s+/g,' ')
 if(!field||!raw||raw.length>120||/[\n\r]|https?:\/\//i.test(text)||onboardingHasPrice(raw)||startsOnboarding(raw)||onboardingLifecycleCommand(raw))return null
 // «Il locale si chiama X» while the owner is asked is about another field: not an answer to this step.
 const named=raw.match(/^(?:(?:il |l[a’'] ?)?(locale|ristorante|titolare|proprietari[oa]|numero|telefono|cellulare|whatsapp|email|e-mail|mail|link|indirizzo))\b/i)?.[1]?.toLowerCase()
 if(named){const about:StepField=/locale|ristorante/.test(named)?'name':/titolare|propriet/.test(named)?'ownerName':/numero|telefono|cellulare|whatsapp/.test(named)?'ownerPhone':/mail/.test(named)?'ownerEmail':'slug';if(about!==field)return null}
 const value=raw.replace(/^(?:(?:il |l[a’'] ?)?(?:locale|ristorante|titolare|proprietari[oa]|nome|numero|telefono|cellulare|whatsapp|email|e-mail|mail|link|indirizzo)(?: del (?:locale|titolare|menu))?(?: si chiama| è| e'|:)?|si chiama|è|e')\s*/i,'').replace(/[.!]+$/,'').trim()
 if(!value)return null
 if(field==='ownerPhone'){const phone=normalizeOwnerPhone(value);return phone?{ownerPhone:phone}:null}
 if(field==='ownerEmail')return /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(value)?{ownerEmail:value}:null
 if(notAnAnswer.test(value)||/@/.test(value))return null
 if(field==='slug'){const slug=onboardingSlug(value);return slug&&slug.length<=40&&value.split(' ').length<=4&&!reservedOnboardingSlug(slug)?{slug}:null}
 if(field==='ownerName')return /^[\p{L}][\p{L}'’. -]{0,79}$/u.test(value)&&value.split(' ').length<=5?{ownerName:onboardingDisplayName(value)}:null
 return value.length<=80&&value.split(' ').length<=8&&/\p{L}/u.test(value)&&!/\d{5}/.test(value)?{name:onboardingDisplayName(value)}:null
}
const safeName=(text:string)=>text.replace(/[*_~`<>]/g,'').slice(0,150)
const euro=(n:number)=>(Number.isInteger(n)?String(n):n.toFixed(2).replace('.',','))+' €'
/** «Mostrami il riepilogo dei menu e dei piatti» (also with «non cambiare/non aggiungere» around it): answered with the recap, no AI call. */
export function onboardingRecapRequest(text:string){
 const c=onboardingCommand(text)
 if(!c||c.length>400||onboardingHasPrice(text)||/https?:\/\//i.test(text))return false
 if(!/\briepilog|\b(?:mostra(?:mi)?|fammi vedere|elenca(?:mi)?|dimmi)\b[^.?!]*\b(?:menu|piatti|bozza|prezzi)\b/.test(c))return false
 return !/\b(?:aggiungi|cambia|modifica|togli|rimuovi|elimina|porta|metti|correggi|aggiorna|sposta|crea)\b/.test(c.replace(/\bnon (?:cambiare|aggiungere|modificare|toccare|togliere|spostare|creare)\b/g,''))
}
const designLabels:Record<string,string>={primary:'pulsanti',background:'sfondo',text:'testo',font:'font',categoryBackground:'sfondo categorie',categoryText:'testo categorie',gradientFrom:'sfumatura',gradientTo:'sfumatura',gradientAngle:'sfumatura'}
/** Menus, categories, dishes and prices of the draft, in plain words. */
export function onboardingRecap(d:OnboardingData){
 const lines:string[]=[]
 for(const m of d.workspace.menus){const sections=m.sections.filter(section=>section.items.length);if(!sections.length)continue;lines.push(`*${safeName(m.name)}*`);for(const section of sections)lines.push(`${safeName(section.name)}: ${section.items.map(i=>`${safeName(i.name)} ${euro(i.price)}`).join(', ')}`)}
 const explicit=Array.isArray(d.explicitDesignFields)?d.explicitDesignFields as string[]:[],design=d.workspace.design
 if(explicit.length)lines.push('Stile: '+[explicit.includes('background')?'sfondo '+design.background:null,explicit.includes('primary')?'pulsanti '+design.primary:null,explicit.includes('text')?'testo '+design.text:null,explicit.includes('font')?'font '+design.font.charAt(0).toUpperCase()+design.font.slice(1):null].filter(Boolean).join(', ')+'.')
 return lines.join('\n')
}
/** Chat messages are folded once read: their data is already in the draft. Only their open doubts are kept, in one
 * compacted source, so a long conversation never reaches the 12-material cap (live 16/10: the 14th message failed). */
function compactChatSources(sources:OnboardingSource[]){
 const chat=sources.filter(x=>x.url.startsWith('message:')&&(x as any).processed)
 if(sources.length<10||chat.length<2)return
 const keep=chat.at(-1)!,folded=chat.filter(x=>x!==keep),issues=[...new Set(folded.flatMap(x=>((x as any).reviewed?[]:(x as any).issues)||[]))] as string[]
 const seq=Math.max(0,...folded.map(x=>Number((x as any).seq)||0))
 for(const x of folded)sources.splice(sources.indexOf(x),1)
 if(issues.length)sources.splice(sources.indexOf(keep),0,{url:'message:compacted',kind:'text',text:'',warnings:[],processed:true,issues,seq} as any)
}
const genericSourceIssue=/^(?:Non riesco a leggere \*piatti e prezzi\*|Ci sono \*\d+ righe\*)/
/** A doubt is about a dish also when written with the verb or a typo («In quale menu va Tieni Burger classico?»). */
const mentions=(issue:string,name:string)=>onboardingCommand(issue).includes(onboardingCommand(name))||mentionsOnboardingDish(issue,name)
/** Doubts of a chat message expire after this many newer chat messages: superseded, the user moved on. */
const chatDoubtLifetime=3
export const onboardingSlug=(text:string)=>onboardingCommand(text).replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,80)
export const reservedOnboardingSlug=(slug:string)=>['staff','api','r','menu','privacy','cookie','terms','onboarding-preview','onboarding-claim','takomenu-public','takomenu-app','assets','m','login','register'].includes(slug)
async function allowed(actor:string,connection:Pick<typeof db,'execute'>=db){if(!isAgencyUser(actor))return false;return(await connection.execute(sql`SELECT id FROM users WHERE id=${actor} AND active=true`)).length>0}
export async function onboardingToken(session:OnboardingSession,kind:'preview'|'claim'){
 const raw=token();await db.execute(sql`INSERT INTO tako_onboarding_tokens(token_hash,session_id,kind,revision,expires_at) VALUES(${onboardingHash(raw)},${session.id},${kind},${session.revision},now()+interval '48 hours')`)
 return `${origin}/onboarding-${kind}/${raw}`
}
export async function onboardingTransport(phone:string,text:string,agencyVoice=false):Promise<{actor:string;active?:boolean}|null>{
 const startActor=await agencyStartActor(text);if(startActor)return{actor:startActor}
 const pair=text.match(/^collega agenzia ([a-f0-9]{64})$/i)
 if(pair){const rows=await db.transaction(async tx=>{await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${`agency-pair:${phone}`},0))`);const codes=await tx.execute(sql`SELECT actor_id FROM tako_onboarding_agency_codes WHERE code_hash=${onboardingHash(pair[1]!.toLowerCase())} AND expires_at>now() FOR UPDATE`);const actor=String(codes[0]?.actor_id||'');const existing=await tx.execute(sql`SELECT actor_id FROM tako_onboarding_agency_links WHERE phone=${phone}`);if(!actor){const prior=String(existing[0]?.actor_id||'');return prior&&await allowed(prior,tx)?existing:[]}if(!await allowed(actor,tx))return[];if(existing.length&&existing[0]!.actor_id!==actor)return[];await tx.execute(sql`DELETE FROM tako_onboarding_agency_codes WHERE code_hash=${onboardingHash(pair[1]!.toLowerCase())}`);return tx.execute(sql`INSERT INTO tako_onboarding_agency_links(phone,actor_id) VALUES(${phone},${actor}) ON CONFLICT(phone) DO UPDATE SET actor_id=EXCLUDED.actor_id RETURNING actor_id`)});return rows[0]?{actor:String(rows[0].actor_id)}:null}
 const rows=await db.execute(sql`SELECT actor_id FROM tako_onboarding_agency_links WHERE phone=${phone}`);const actor=String(rows[0]?.actor_id||'');if(!actor||!await allowed(actor))return null
 const current=await activeOnboarding(actor,phone)
 if(onboardingLifecycleCommand(text)||agencyVoice||startsOnboarding(text)||/^(?:riprendi|stato onboarding|elenco onboarding|esci onboarding|annulla onboarding|approva e attiva|anteprima onboarding|prepara onboarding|invito titolare)\b/i.test(text)||current&&!current.data.paused)return{actor,active:!!current&&!current.data.paused}
 return null
}
const expiredWindowMinutes=60
/**
 * After a draft expires the chat would fall back to the owner flow (or MenuSmart) and treat
 * «LOGO: …» or a menu voice note as an edit of a real restaurant. The first message after an
 * expiry — and any LOGO/HERO caption with no draft — gets a clear notice instead, and is not applied anywhere.
 */
export const expiredNoticeOpenings=['La *bozza* del nuovo locale è *scaduta*','Non c’è una *bozza aperta*']
export async function expiredOnboardingNotice(phone:string,text:string,form:Record<string,string>,options:{excludeSid?:string;record?:boolean}={}):Promise<string|{voiceActor:string}|null>{
 const links=await db.execute(sql`SELECT actor_id FROM tako_onboarding_agency_links WHERE phone=${phone}`),actor=String(links[0]?.actor_id||'')
 if(!actor||!await allowed(actor))return null
 const open=await db.execute(sql`SELECT 1 FROM tako_onboarding_sessions WHERE actor_id=${actor} AND phone=${phone} AND state IN('collecting','review') AND expires_at>now() LIMIT 1`)
 if(open.length)return null
 const latest=(await db.execute(sql`SELECT sid,status,payload,updated_at>now()-make_interval(mins=>${expiredWindowMinutes}) AS recent FROM tako_onboarding_inbox_jobs WHERE phone=${phone} AND sid<>${options.excludeSid||''} ORDER BY updated_at DESC LIMIT 1`))[0] as {sid?:string;status?:string;payload?:any;recent?:boolean}|undefined
 const assetCaption=Number(form.NumMedia)>0&&/^image\//i.test(form.MediaContentType0||'')&&['logo','hero'].includes(String(onboardingAssetRole(text)))
 const justExpired=!!latest?.recent&&latest.status!=='pending'&&latest.status!=='running'&&!latest.payload?.expiredNotice&&!latest.payload?.closed
 if(!justExpired&&!assetCaption)return null
 // A vocal is judged on its words, like the same text: it is transcribed in the onboarding queue first
 // («Crea locale …» starts a new draft, anything else gets this notice there).
 if(justExpired&&Number(form.NumMedia)>0&&whatsappAudioType(form.MediaContentType0,form.Body))return {voiceActor:actor}
 if(options.record!==false){const inserted=await db.execute(sql`INSERT INTO tako_onboarding_inbox_jobs(sid,actor_id,phone,payload,status) VALUES(${form.MessageSid||'OB'+randomBytes(16).toString('hex')},${actor},${phone},${JSON.stringify({expiredNotice:true})}::jsonb,'done') ON CONFLICT DO NOTHING RETURNING sid`);if(!inserted.length&&!assetCaption)return null}
 const owner=await db.execute(sql`SELECT r.name FROM tako_whatsapp_links l JOIN restaurants r ON r.id=l.restaurant_id WHERE l.phone=${phone} LIMIT 1`),restaurant=owner[0]?.name?safeName(String(owner[0].name)):''
 return [justExpired?expiredNoticeOpenings[0]+' dopo 10 minuti senza attività. Questo messaggio non è stato applicato.':expiredNoticeOpenings[1]+': questo messaggio non è stato applicato.','Per ricominciare scrivi *Crea locale Nome*.',...(restaurant?[`Se era una modifica per *${restaurant}*, rimandala.`]:[])].join('\n\n')
}
export const pendingOnboardingTranslations=(w:OnboardingData['workspace'])=>COMMON_MENU_LANGUAGES.filter(lang=>lang!==w.defaultLanguage&&(w.menus.some(m=>[m,...m.sections.flatMap(s=>[s,...s.items])].some(entity=>!entity.translations[lang]?.name?.trim()||!!entity.description?.trim()&&!entity.translations[lang]?.description?.trim()))||['allergens',...foodCatalogs.allergens.map(x=>x.id),...foodCatalogs.traits.map(x=>x.id),...foodCatalogs.additives.map(x=>x.id)].some(id=>!w.foodTranslations[lang]?.[id]?.trim())))
export const pendingOnboardingSources=(d:OnboardingData)=>!!(Array.isArray(d.pendingAcquisitions)&&d.pendingAcquisitions.length)||(Array.isArray(d.sources)&&d.sources.some((source:any)=>!source.processed))
export const missingOnboardingFields=(d:OnboardingData)=>[...(pendingOnboardingSources(d)?['Materiali ancora in elaborazione']:[]),...(!d.name?['Nome del locale']:[]),...(!d.slug||reservedOnboardingSlug(d.slug)?['Indirizzo del menu valido']:[]),...(!d.ownerName?['Nome del titolare']:[]),...(!d.ownerPhone?['Cellulare del titolare']:[]),...(!d.ownerEmail?['Email personale del titolare']:[]),...(!d.workspace.menus.some(m=>m.sections.some(s=>s.items.length))?['Menu con piatti e prezzi']:[]),...d.unresolved,...(d.workspace.menus.some(m=>m.sections.some(s=>s.items.length))&&pendingOnboardingTranslations(d.workspace).length?['Traduzioni da completare: scrivi PREPARA ONBOARDING']:[])]
export function nextOnboardingStep(d:OnboardingData):string{
 if(!d.name)return 'Come si chiama il *locale*? Se ha un sito, mandami anche il *link*.'
 if(pendingOnboardingSources(d))return 'Sto leggendo i *materiali*.'
 if(!d.workspace.menus.some(m=>m.sections.some(section=>section.items.length)))return 'Mandami il *menu*: PDF, foto nitide o testo con i prezzi.'
 if(d.unresolved.length){const issue=d.unresolved[0]!.replace(/^Fonte \d+:\s*/,'').slice(0,220),others=d.unresolved.length-1;return [/\?\s*$/.test(issue)?issue:issue+'\nPuoi inviare il dato corretto?',...(others?[`Poi ${others===1?'c’è *un altro dato*':'ci sono *altri '+others+' dati*'} da controllare.`]:[])].join('\n')}
 if(!d.ownerName)return 'Come si chiama il *titolare*?'
 if(!d.ownerPhone)return 'Qual è il *numero WhatsApp del titolare*, con prefisso internazionale?'
 if(!d.ownerEmail)return 'Qual è l’*email del titolare*?'
 if(!d.slug||reservedOnboardingSlug(d.slug))return 'Indicami un *nome breve per il link del menu*.'
 if(pendingOnboardingTranslations(d.workspace).length)return 'Sto completando le *traduzioni*.'
 return 'Controlla l’anteprima. Per pubblicare, scrivi *APPROVA E ATTIVA*.'
}
export async function summary(s:OnboardingSession,mode:'progress'|'recap'='progress',showChanges=false){
 const count=s.data.workspace.menus.reduce((n,m)=>n+m.sections.reduce((p,c)=>p+c.items.length,0),0),preview=count&&!pendingOnboardingSources(s.data)?await onboardingToken(s,'preview'):null
 // Without a locale name yet, changes are still confirmed (live 16/10: Sorbetto added with no confirmation).
 if(!s.data.name){const done=showChanges&&Array.isArray(s.data.lastChanges)&&s.data.lastChanges.length?['Fatto: '+(s.data.lastChanges as string[]).slice(0,8).join('; ')+'.']:[],said=showChanges&&Array.isArray(s.data.lastNotes)?(s.data.lastNotes as string[]).slice(0,4):[];return [...done,...said,nextOnboardingStep(s.data),'La bozza si elimina dopo *10 minuti senza attività*.'].join('\n\n')}
 const saved=[s.data.ownerName?'nome titolare':null,s.data.ownerPhone?'WhatsApp':null,s.data.ownerEmail?'email':null,s.data.workspace.design.logoUrl?'logo':null,s.data.workspace.design.coverUrl?'copertina':null].filter(Boolean)
 const changes=showChanges&&Array.isArray(s.data.lastChanges)?(s.data.lastChanges as string[]).slice(0,8):[],recap=mode==='recap'?onboardingRecap(s.data):''
 return [`*${safeName(s.data.name)}*${count?' · '+count+' piatti':''}.`,...(changes.length?['Fatto: '+changes.join('; ')+'.']:showChanges&&s.data.lastNoChange?['Nessuna modifica ai piatti: erano già così.']:[]),...(showChanges&&Array.isArray(s.data.lastNotes)&&s.data.lastNotes.length?[(s.data.lastNotes as string[]).slice(0,4).join('\n')]:[]),...(recap?[recap]:[]),...(mode==='recap'?[saved.length?'Raccolti: '+saved.join(', ')+'.':'Nessun contatto del titolare ancora raccolto.']:[]),...(typeof s.data.recentAssetNotice==='string'?[s.data.recentAssetNotice]:[]),nextOnboardingStep(s.data),...(preview?['*Anteprima privata*:\n'+preview]:[]),...(mode==='recap'?['La bozza si elimina dopo *10 minuti senza attività*.']:[])].join('\n\n')
}
/** Sent when background work (translations) finishes: the link, plus the approval step only when nothing else is missing. */
export async function previewReady(s:OnboardingSession){
 const count=s.data.workspace.menus.reduce((n,m)=>n+m.sections.reduce((p,c)=>p+c.items.length,0),0)
 if(!count||pendingOnboardingSources(s.data))return ''
 const link=await onboardingToken(s,'preview'),ready=!missingOnboardingFields(s.data).length
 return [`L’*anteprima privata* di *${safeName(s.data.name||'nuovo locale')}* è pronta:\n${link}`,...(ready?['Per pubblicare, scrivi *APPROVA E ATTIVA*.']:[])].join('\n\n')
}
/** Open doubts in plain words: no internal source numbers in chat. */
export function onboardingSourceIssues(sources:OnboardingSource[]):string[]{return [...new Set(sources.flatMap(source=>(source as any).reviewed?[]:(source as any).issues||[]))] as string[]}
/** Model for onboarding translations. Default stays gpt-oss-120b: in the live test of 15/10 gpt-oss-20b
 * returned HTTP 400 (invalid JSON) on Spanish. A separate model (own tokens-per-minute bucket) can be set with
 * TAKO_ONBOARDING_TRANSLATION_MODEL once verified. */
const onboardingTranslationProvider=()=>typeof groqTranslationProviderFor==='function'?groqTranslationProviderFor(process.env.TAKO_ONBOARDING_TRANSLATION_MODEL||process.env.GROQ_TRANSLATION_MODEL||'openai/gpt-oss-120b'):undefined
async function translateOnboarding(s:OnboardingSession,budgetMs=50000){
 const started=Date.now();let d=structuredClone(s.data)
 for(const language of COMMON_MENU_LANGUAGES){
  if(language===d.workspace.defaultLanguage)continue
  while(pendingOnboardingTranslations(d.workspace).includes(language)){
   if(Date.now()-started>budgetMs-45000)return s
   const translated=await translateWorkspace(d.workspace,language,onboardingTranslationProvider()).catch(error=>{throw classifyOnboardingTranslationFailure(error,language)})
   d.workspace=translated.workspace;d.workspace.languages=[...COMMON_MENU_LANGUAGES]
   d.warnings=[...new Set([...d.warnings,...translated.warnings])].slice(-100)
   s=await updateOnboarding(s.id,s.actorId,s.revision,d,missingOnboardingFields(d).length?'collecting':'review')
   d=structuredClone(s.data)
   if(!translated.translatedCount)break
  }
 }
 return s
}
async function prepare(s:OnboardingSession,text:string,form:Record<string,string>){
 const d=structuredClone(s.data),key=process.env.GROQ_API_KEY||'',sources=(Array.isArray(d.sources)?d.sources:[]) as OnboardingSource[]
 const acquisitions=(Array.isArray(d.pendingAcquisitions)?d.pendingAcquisitions:[]) as any[],seenMessages=(Array.isArray(d.ingestedMessages)?d.ingestedMessages:[]) as string[]
 const messageKey=form.MessageSid||''
 const fresh=!messageKey||!seenMessages.includes(messageKey)
 if(fresh&&form.OnboardingInternal!=='1')d.recentAssetNotice=null
 const changes:string[]=fresh?[]:Array.isArray(d.lastChanges)?[...d.lastChanges as string[]]:[];d.lastChanges=changes
 const touched:OnboardingSource[]=[];if(fresh){d.lastNoChange=false;d.lastNotes=[]}
 const notes:string[]=Array.isArray(d.lastNotes)?d.lastNotes as string[]:[];d.lastNotes=notes
 // A one-word reply that is a menu name answers the open question; it never becomes the locale or owner name.
 const menuWord=d.workspace.menus.some(m=>onboardingCommand(m.name)===onboardingCommand(text.replace(/[.!]+$/,'')))
 // Answer to «Quale Burger: Pranzo o Cena?»: the menu name applies the pending price to that dish (same id).
 let choices=(Array.isArray(d.pendingChoices)?d.pendingChoices:[]) as OnboardingChoice[],choiceHandled=false
 const settle=(names:string[],except?:OnboardingSource)=>{if(!names.length)return;for(const prior of sources){if(prior===except)continue;const p=prior as any;p.issues=(p.issues||[]).filter((issue:string)=>!names.some(name=>mentions(issue,name)))}}
 if(fresh&&choices.length&&text.trim()&&!(Number(form.NumMedia)>0)&&!onboardingHasPrice(text)&&text.length<=80&&form.OnboardingInternal!=='1'){
  const answer=` ${onboardingCommand(text).replace(/[^a-z0-9 ]+/g,' ')} `,choice=choices[0]!,picked=choice.options.filter(o=>answer.includes(` ${onboardingCommand(o.menu)} `))
  if(picked.length===1&&choice.add&&!picked[0]!.itemId){
   // «In quale menu va Sorbetto?» → «Cena»: the dish goes into that menu, nothing else (never a name or owner).
   const placed=mergeOnboardingRows(d.workspace,[{menu:picked[0]!.menu,menuExplicit:true,section:choice.add.section,name:choice.name,price:choice.price,description:choice.add.description,evidence:choice.name,intent:'add'}],false)
   changes.push(...placed.changes);choiceHandled=true;choices=choices.slice(1);settle([choice.name])
  }else if(picked.length===1){for(const m of d.workspace.menus)for(const section of m.sections)for(const item of section.items)if(item.id===picked[0]!.itemId){if(item.price!==choice.price)changes.push(`*${safeName(item.name)}* (${safeName(m.name)}) ${euro(item.price)} → ${euro(choice.price)}`);item.price=choice.price;choiceHandled=true}
   if(choiceHandled){choices=choices.slice(1);settle([choice.name])}}
 }
 d.pendingChoices=choices
 const captionRole=onboardingAssetRole(text),pureAssetCaption=Number(form.NumMedia)>0&&/^image\//i.test(form.MediaContentType0||'')&&captionRole!==null&&!onboardingHasPrice(text)&&!/(?:titolare|telefono|email|e-mail|si chiama|@[a-z])/i.test(text)
 if(fresh&&text&&!choiceHandled&&!pureAssetCaption&& !/^(?:riprendi|prepara onboarding|anteprima onboarding|stato onboarding|verificato fonte)\b/.test(onboardingCommand(text))){
 // The reply to the question just asked is accepted directly (same path for typed and transcribed text).
 const step=Number(form.NumMedia)>0||menuWord?null:onboardingStepAnswer(d,text),planned:Awaited<ReturnType<typeof extractOnboardingMessage>>=step?{}:await extractOnboardingMessage(text,key),fields={...planned,...planned.corrections,...(step||{})}
 if(!fields.name&&!d.name){const name=onboardingCreationName(text);if(name)fields.name=name}
 const explicitCorrection=!!planned.corrections||/\b(cambia|correggi|modifica|aggiorna|porta)\b[\s\S]*\b(prezzo|euro|euri)\b/i.test(text)
 if(explicitCorrection)d.lastExplicitCorrection=text.slice(0,2000)
 if(menuWord)for(const k of ['name','ownerName','slug','styleRestaurant'] as const)delete fields[k]
 // An already-filled locale/owner field is changed only by an explicit correction or a sentence that talks about it
 // (live 16/10 on v77: «Metti il Risotto ai funghi a 15 euro» renamed the locale «Risotto ai funghi»).
 const fieldContext:Record<string,RegExp>={name:/\b(?:locale|ristorante|bar|pizzeria|trattoria|osteria|si chiama|nome)\b/i,ownerName:/\b(?:titolare|proprietari[oa]|gestore|si chiama)\b/i,ownerEmail:/@/,slug:/\b(?:link|indirizzo)\b/i}
 for(const k of ['name','ownerName','ownerEmail','slug'] as const)if(fields[k]&&d[k]&&!(step&&k in step)&&!(planned.corrections&&k in planned.corrections&&fieldContext[k]!.test(text))&&!fieldContext[k]!.test(text))delete fields[k]
 for(const k of ['name','ownerName','ownerEmail'] as const)if(fields[k])d[k]=fields[k]!
 if(fields.ownerName)changes.push(`titolare *${safeName(String(fields.ownerName))}*`);if(fields.ownerEmail)changes.push('email del titolare salvata')
 if(fields.ownerPhone){const phone=normalizeOwnerPhone(fields.ownerPhone);if(phone){d.ownerPhone=phone;changes.push('WhatsApp del titolare salvato')}else {delete d.ownerPhone;d.warnings.push('Verifica il *numero WhatsApp del titolare*.')}}
 if(fields.slug)d.slug=onboardingSlug(fields.slug);if(!d.slug&&d.name)d.slug=onboardingSlug(d.name)
 if(fields.styleRestaurant){const matches=await db.execute(sql`SELECT w.published FROM restaurants r JOIN menu_workspaces w ON w.restaurant_id=r.id WHERE lower(r.name)=lower(${fields.styleRestaurant}) AND r.active=true`);if(matches.length===1&&matches[0]?.published){const design=workspaceSchema.parse(matches[0].published).design;d.workspace.design={...design,logoUrl:d.workspace.design.logoUrl,coverUrl:d.workspace.design.coverUrl,backgroundImageUrl:null,reviewUrl:null,socialLinks:{},links:[]}}else d.warnings.push('Non riconosco il *locale di riferimento*. Lo stile resta invariato.')}
 if(fields.designInstructions?.length){const design=applyOnboardingDesign(d.workspace.design,fields.designInstructions);d.workspace.design=design.design;const priorIssues=d.designIssuesByField&&typeof d.designIssuesByField==='object'?{...d.designIssuesByField as Record<string,string[]>}:Object.fromEntries((Array.isArray(d.designIssues)?d.designIssues as string[]:[]).map(issue=>[/angolo/i.test(issue)?'gradientAngle':/font/i.test(issue)?'font':'other',[issue]]));for(const instruction of fields.designInstructions)delete priorIssues[instruction.field];if(d.workspace.design.backgroundGradient&&!design.issuesByField.gradient)delete priorIssues.gradient;Object.assign(priorIssues,design.issuesByField);d.designIssuesByField=priorIssues;d.designIssues=Object.values(priorIssues).flat();d.explicitDesignFields=[...new Set([...(Array.isArray(d.explicitDesignFields)?d.explicitDesignFields:[]),...design.applied])];if(design.applied.length)changes.push('stile aggiornato ('+[...new Set(design.applied.map(f=>designLabels[f]||f))].join(', ')+')')}
 if(fields.menuStructure?.length)for(const structure of fields.menuStructure){let target=d.workspace.menus.find(m=>onboardingCommand(m.name)===onboardingCommand(structure.menu));if(!target){target=workspaceSchema.parse({menus:[{id:randomUUID(),name:onboardingDisplayCase(structure.menu),active:true}]}).menus[0]!;d.workspace.menus.push(target)}if(structure.section&&!target.sections.some(section=>onboardingCommand(section.name)===onboardingCommand(structure.section!))){target.sections.push(workspaceSchema.parse({menus:[{id:randomUUID(),name:'tmp',sections:[{id:randomUUID(),name:onboardingDisplayCase(structure.section)}]}]}).menus[0]!.sections[0]!)}}
 // «Elimina il Burger classico», «Sposta…», «Rinomina…» without a price: applied (remove) or explained, never ignored.
 let nonPriceOnly=false
 if(!onboardingHasPrice(text)&&!(Number(form.NumMedia)>0)){const existingNames=d.workspace.menus.flatMap(m=>m.sections.flatMap(section=>section.items.map(item=>item.name))),req=onboardingNonPriceRequests(text,existingNames)
  const asked=[...req.remove.map(name=>({name,intent:'remove' as const})),...req.move.map(name=>({name,intent:'move' as const})),...req.rename.map(name=>({name,intent:'rename' as const}))]
  nonPriceOnly=asked.length>0
  if(asked.length){const done=mergeOnboardingRows(d.workspace,asked.map(a=>({name:a.name,price:0,section:'Menu',description:'',evidence:a.name,intent:a.intent})),false);changes.push(...done.changes);notes.push(...done.notes,...done.issues)}}
 // A pure «elimina/sposta/rinomina» message is not menu material (live: «Manca il prezzo di Burger della casa»).
 if(!nonPriceOnly&&(fields.menuText||onboardingHasPrice(text))){const url='message:'+(form.MessageSid||randomUUID());if(!sources.some(source=>source.url===url))sources.push({url,kind:'text',text:fields.menuText||text,warnings:[],...(explicitCorrection?{correction:true}:{})} as OnboardingSource)}
 const urls=[...new Set(text.match(/https:\/\/[^\s<>]+/gi)||[])].slice(0,3)
 for(const raw of urls){const url=raw.replace(/[),.;]+$/,'');if(!sources.some(x=>x.url===url)&&!acquisitions.some(x=>x.url===url))acquisitions.push({kind:'url',url,followMenu:true})}
 }
 if(fresh){
  const mediaCount=Math.min(4,Math.max(0,Number(form.NumMedia)||0))
  if(Number(form.NumMedia)>4)d.warnings.push('Posso leggere *4 allegati per messaggio*. Invia gli altri a parte.')
  for(let index=0;index<mediaCount;index++){
   const mediaUrl=form['MediaUrl'+index],url='whatsapp:'+form.MessageSid+':'+index
   if(mediaUrl&&!sources.some(x=>x.url===url)&&!acquisitions.some(x=>x.url===url))acquisitions.push({kind:'media',url,mediaUrl,mime:form['MediaContentType'+index]||'',caption:text})
  }
  if(messageKey)seenMessages.push(messageKey)
 }
 // Acquisition descriptors preserve the original media URL, MIME and caption across
 // signed continuations. A completed descriptor and its source are saved atomically.
 const acquisition=acquisitions.shift()
 if(acquisition){
  compactChatSources(sources)
  if(sources.length>=12){d.warnings.push('Hai raggiunto *12 fonti*. Gli altri materiali non sono stati importati.');d.manualIssues=[...(Array.isArray(d.manualIssues)?d.manualIssues:[]),'Hai raggiunto *12 fonti*. Controlla che il menu sia completo.'];acquisitions.length=0}
  else if(acquisition.kind==='url'){
   try{
    const source=await ingestOnboardingSource(acquisition.url,{ocrImage:(bytes,mime)=>ocrOnboardingImage(bytes,mime,key)});sources.push(source)
    if(!d.name&&source.name){d.name=source.name;d.slug=onboardingSlug(source.name)}
    const primary=source.colors?.find(color=>isChromatic(color));if(primary&&!(Array.isArray(d.explicitDesignFields)&&d.explicitDesignFields.includes('primary')))d.workspace.design.primary=primary
    if(source.logoUrl&&!d.workspace.design.logoUrl)try{const logo=await guardedFetch(source.logoUrl,'image',{httpsOnly:true},{maxBytes:2*1024*1024,timeoutMs:8000});d.workspace.design.logoUrl=await stageOnboardingImage(s.id,logo.body,logo.contentType)}catch{d.warnings.push('Non riesco a usare il *logo del sito*. Invialo come foto con didascalia *LOGO*.')}
    // Follow at most one same-origin menu, as another bounded acquisition.
    if(acquisition.followMenu){const menu=source.menuLinks?.find(link=>new URL(link).origin===new URL(source.url).origin&&!sources.some(x=>x.url===link)&&!acquisitions.some(x=>x.url===link));if(menu)acquisitions.push({kind:'url',url:menu,followMenu:false})}
   }catch{sources.push({url:acquisition.url,kind:'text',warnings:[],issues:['Non riesco a leggere il *link*. Invia il menu come PDF o foto.'],processed:true} as OnboardingSource)}
  }else{
   const {url,mediaUrl,mime,caption}=acquisition
   try{
    const media=await downloadTwilioMedia(mediaUrl,process.env.TWILIO_ACCOUNT_SID||'',process.env.TWILIO_AUTH_TOKEN||'',8*1024*1024,12000)
    const role=onboardingAssetRole(caption)
    if(/^image\//.test(mime)&&role){
     if(role==='ambiguous'){sources.push({url,kind:'image',warnings:[],issues:['Reinvia l’immagine con *LOGO* o *HERO* nella didascalia. Non ho sostituito le immagini.'],processed:true} as OnboardingSource)}else{
     const asset=await stageOnboardingImage(s.id,media.bytes,mime);if(role==='hero')d.workspace.design.coverUrl=asset;else {d.workspace.design.logoUrl=asset;if(/trasparen/i.test(caption)&&/^image\/jpe?g$/i.test(mime)){const notice='Ho ricevuto un *JPEG*: non conserva la trasparenza. Per il *logo trasparente*, invia il PNG come *documento*.';d.recentAssetNotice=notice;d.warnings.push(notice)}}
     sources.push({url,kind:'image',warnings:[],processed:true} as OnboardingSource)}
    }else{
     let inspected=await inspectOnboardingMedia(media.bytes,mime,{ocrImage:(bytes,type)=>ocrOnboardingImage(bytes,type,key)})
     if(inspected.kind==='pdf'&&!inspected.text&&process.env.GEMINI_API_KEY)inspected={...inspected,text:await ocrOnboardingPdf(media.bytes)}
     sources.push({url,...inspected})
    }
   }catch{sources.push({url,kind:'text',warnings:[],issues:['Non riesco a leggere l’*allegato*. Invia una foto nitida o un PDF leggibile.'],processed:true} as OnboardingSource)}
  }
 }
 d.pendingAcquisitions=acquisitions;d.ingestedMessages=seenMessages.slice(-200)
 compactChatSources(sources)
 if(sources.length>12)throw Object.assign(new Error('Hai raggiunto *12 materiali* (PDF, foto, siti). Continua dalla dashboard: la bozza è salva.'),{code:'VALIDATION'})
 d.unresolved=[...(Array.isArray(d.manualIssues)?d.manualIssues as string[]:[]),...(Array.isArray(d.designIssues)?d.designIssues as string[]:[])]
 const verification=onboardingCommand(text).match(/^verificato fonte (\d+)$/)
 if(verification){const source=sources[Number(verification[1])-1] as any;if(source){source.reviewed=true;source.reviewedAt=new Date().toISOString();source.issues=[]}}
 for(const source of sources){if(acquisition)break;if((source as any).processed)continue;if(!source.text?.trim()){(source as any).issues=['Non trovo *testo leggibile*. Invia una foto nitida o il testo del menu.'];(source as any).processed=true;continue}if(source.kind==='html'&&!/[€]|\bEUR\b|\d[,.]\d{2}/i.test(source.text)){(source as any).processed=true;continue}
 const offset=Number((source as any).extractionOffset)||0
 let end=Math.min(offset+12000,source.text.length);if(end<source.text.length){const newline=source.text.lastIndexOf('\n',end-1);if(newline>offset+6000)end=newline+1}
 const chunk=source.text.slice(offset,end),extracted=await extractOnboardingMenu(chunk,key),message=source.url.startsWith('message:')
 // Guardrail: every price clause of a chat message is applied or asked. A clause the model left out is rebuilt
 // deterministically when it names one dish already in the draft (live 16/10: «cambia il Burger classico da dodici a tredici»).
 const before=d.workspace.menus.flatMap(m=>m.sections.flatMap(section=>section.items.map(item=>item.name)))
 const guard=message?onboardingUncoveredClauses(chunk,extracted.rows,before,d.workspace.menus.map(m=>m.name)):{rows:[],issues:[]}
 const merged=mergeOnboardingRows(d.workspace,[...extracted.rows,...guard.rows],!!(source as any).correction)
 // A chat message talks about dishes already in the draft («non cambiare la Pasta»): model doubts about those are noise.
 const existing=d.workspace.menus.flatMap(m=>m.sections.flatMap(section=>section.items.map(item=>item.name)))
 let own=[...((source as any).issues||[]),...(message?extracted.issues.filter(issue=>!existing.some(name=>mentions(issue,name))&&!guard.rows.some(r=>mentions(issue,r.name))):extracted.issues),...guard.issues,...merged.issues]
 // Chat messages: coverage is checked clause by clause by the guardrail, the generic «no dishes read» doubt is noise.
 if(message)own=own.filter(issue=>!genericSourceIssue.test(issue))
 ;(source as any).issues=[...new Set(own)]
 // A newer message about a dish closes the older doubts about it; generic doubts of older chat messages are superseded.
 settle([...merged.resolvedNames,...extracted.rows.map(row=>row.name)],source)
 if(message){const seq=Number(d.chatMessageSeq||0)+1;d.chatMessageSeq=seq;(source as any).seq=seq
  for(const prior of sources){if(prior===source||!prior.url.startsWith('message:'))continue;const p=prior as any;p.issues=(p.issues||[]).filter((issue:string)=>!genericSourceIssue.test(issue));if(typeof p.seq==='number'&&seq-p.seq>=chatDoubtLifetime)p.issues=[];if(typeof p.seq==='number'&&seq>p.seq)p.issues=(p.issues||[]).filter((issue:string)=>!/^Non ho capito questa parte/.test(issue))}}
 changes.push(...merged.changes);notes.push(...merged.notes);touched.push(source)
 if(message&&!merged.changes.length&&!merged.notes.length&&!(source as any).issues.length)d.lastNoChange=true
 d.pendingChoices=[...merged.choices,...(d.pendingChoices as OnboardingChoice[]).filter(c=>!merged.choices.some(n=>onboardingCommand(n.name)===onboardingCommand(c.name))&&!merged.resolvedNames.some(n=>onboardingCommand(n)===onboardingCommand(c.name)))].slice(0,5)

 ;(source as any).extractionOffset=end;(source as any).processed=end>=source.text.length
 // One source chunk per invocation. Item merges and cursor advance commit together.
 break
 }
 // Doubts raised by this message come first, so the reply always answers what was just asked.
 const current=onboardingSourceIssues(touched)
 d.unresolved=[...new Set([...current,...d.unresolved,...onboardingSourceIssues(sources)])];d.sources=sources;d.warnings=[...new Set([...d.warnings,...sources.flatMap(x=>x.warnings)])].slice(-100)
 d.workspace=workspaceSchema.parse(d.workspace);return updateOnboarding(s.id,s.actorId,s.revision,d,missingOnboardingFields(d).length?'collecting':'review')
}
export async function handleOnboardingChat(actor:string,phone:string,text:string,form:Record<string,string>={}){
 if(form.OnboardingVoice==='1'&&onboardingCommand(text)==='approva e attiva')return 'Per pubblicare, scrivi *APPROVA E ATTIVA*. Il vocale non conferma la pubblicazione.'
 if(!await allowed(actor))return 'L’accesso *agenzia* non è più attivo. Contatta l’amministratore.'
 if(startsOnboarding(text))await purgeExpiredOnboarding()
 if(onboardingLifecycleCommand(text)){try{const resumed=await redeemAgencyOnboardingCode(actor,phone,text);if(resumed){const session=await getOnboarding(resumed.id,actor);return session?summary(session,'recap'):'La *bozza è scaduta*. Crea un nuovo QR dalla dashboard.'}}catch(e){return e instanceof Error?e.message:'*QR non disponibile*. Creane uno nuovo dalla dashboard.'}}
 if(form.OnboardingInternal!=='1'&&(text.trim()||Number(form.NumMedia)>0)&&!/^(?:elenco onboarding|stato onboarding|anteprima onboarding)$/i.test(text.trim()))await touchOnboardingActivity(actor,phone)
 if(/^collega agenzia /i.test(text))return '*Agenzia collegata*. Per iniziare, scrivi *Crea locale Nome*.'
 if(onboardingCommand(text)==='elenco onboarding'){const rows=await listOnboarding(actor);return rows.length?rows.slice(0,8).map(s=>`*${safeName(s.data.name||'Nuovo locale')}* · ${s.state==='activated'?'attivo':s.state==='review'?'pronto da controllare':'in preparazione'}`).join('\n'):'Non ci sono *inserimenti* da mostrare.'}
 if(/^(?:invito titolare|stato onboarding|approva e attiva)(?: [a-f0-9-]{36})?$/.test(onboardingCommand(text))){
  const open=await activeOnboarding(actor,phone)
  if(!open){const id=text.trim().split(/\s+/).at(-1);const previous=(await listOnboarding(actor)).find(item=>item.phone===phone&&item.state==='activated'&&(!/^[a-f0-9-]{36}$/.test(id||'')||item.id===id));if(previous){const claim=await onboardingToken(previous,'claim'),invite=await createOwnerInvite(previous);return `*${safeName(previous.data.name)}* è già attivo.\n\n*Menu*: ${origin}/r/${previous.restaurantId}/menu\n*WhatsApp titolare* · 7 giorni:\n${invite.url}\n*QR personale*: ${invite.qrUrl}\n*Accesso dashboard* · 48 ore:\n${claim}`}}
 }
 let s=await activeOnboarding(actor,phone)
 if(onboardingCommand(text)==='riprendi'&&!s){const previous=(await listOnboarding(actor)).find(item=>item.phone===phone&&item.data.paused&&['collecting','review'].includes(item.state));if(previous)s=previous}
 if(/^riprendi [a-f0-9-]{36}$/i.test(text)){const requested=text.trim().split(/\s+/)[1]!;if(s&&s.id!==requested)return 'C’è un’altra *bozza aperta*. Scrivi *ESCI ONBOARDING* o *ANNULLA ONBOARDING* prima di riprendere questa.';s=await getOnboarding(requested,actor);if(!s||s.phone!==phone||!['collecting','review'].includes(s.state))return 'La *bozza* è scaduta o già conclusa.'}
 if(s?.data.paused&&onboardingCommand(text)!=='esci onboarding')s=await updateOnboarding(s.id,actor,s.revision,{...s.data,paused:false},s.state==='review'?'review':'collecting')
 if(!s){if(!startsOnboarding(text)){
  // Transcribed vocal after an expiry: the same notice typed text gets (recorded on the job by the queue).
  if(form.OnboardingVoice==='1'){const notice=await expiredOnboardingNotice(phone,text,{...form,NumMedia:'0'},{excludeSid:form.MessageSid,record:false});if(typeof notice==='string')return notice}
  return 'Per iniziare, scrivi *Crea locale Nome*.'}
 s=await createOnboarding(actor,phone,{name:'',slug:'',workspace:workspaceSchema.parse({menus:[],design:menuLayoutDefaults}),warnings:[],unresolved:[]})}
 const c=onboardingCommand(text)
 if(c==='annulla onboarding'){await cancelOnboarding(s.id,actor,s.revision);await purgeExpiredOnboarding();return '*Inserimento annullato*. Nessun locale pubblicato.'}
 if(c==='esci onboarding'){// Keep materials, end interception until explicit resume.
  await updateOnboarding(s.id,actor,s.revision,{...s.data,paused:true},s.state==='review'?'review':'collecting');return '*Bozza in pausa*. Scrivi *RIPRENDI* per continuare. Si elimina dopo *10 minuti senza attività*.'}
 if(c==='approva e attiva'){
  if(s.state!=='review'||missingOnboardingFields(s.data).length)return summary(s)
  const result=await approveOnboarding(s.id,actor,s.revision),claim=await onboardingToken(result.session,'claim'),invite=await createOwnerInvite(result.session);return `*${safeName(result.restaurant.name)}* è attivo.\n\n*Menu cliente*: ${origin}/r/${result.restaurant.id}/menu\n*QR menu*: ${origin}/api/onboarding/qr/${result.restaurant.id}\n\nInoltra al titolare il *link o QR WhatsApp* · 7 giorni:\n${invite.url}\n*QR personale*: ${invite.qrUrl}\n\n*Accesso dashboard* · 48 ore:\n${claim}\n\nIl titolare apre il link dal *suo numero WhatsApp*.`
 }
 if(c==='stato onboarding'||c==='anteprima onboarding'||!(Number(form.NumMedia)>0)&&onboardingRecapRequest(text))return summary(s,'recap')
 s=await prepare(s,text,form);
 if(c==='prepara onboarding'&&!pendingOnboardingSources(s.data)){
  const d=structuredClone(s.data)
  if(!d.workspace.design.coverUrl&&!d.heroAttempted&&d.name){d.heroAttempted=true;try{const hero=await generateOnboardingHero(d.name,d.workspace.menus.flatMap(m=>m.sections.flatMap(c=>c.items.map(i=>i.name))).slice(0,8),d.workspace.design.primary);if(hero)d.workspace.design.coverUrl=await stageOnboardingImage(s.id,hero.bytes,hero.mime);else d.warnings.push('La *copertina automatica* non è disponibile. Invia un’immagine con didascalia *HERO*.')}catch{d.warnings.push('Non ho creato la *copertina*. Invia un’immagine con didascalia *HERO*.')}s=await updateOnboarding(s.id,actor,s.revision,d,missingOnboardingFields(d).length?'collecting':'review');return summary(s)}
  s=await translateOnboarding(s)
  // Background completion: announce only the preview, never re-ask the question the user already has on screen.
  if(form.OnboardingInternal==='1'&&!pendingOnboardingTranslations(s.data.workspace).length)return previewReady(s)
 }
 return summary(s,c.startsWith('riprendi')?'recap':'progress',form.OnboardingInternal!=='1')
}
/** Claims one job per phone under a transaction lock; provider work runs outside SQL transactions.
 * A worker drains the persisted queue, so fast subsequent messages are never lost. */
const userErrorCodes=new Set(['VALIDATION','CONFLICT','SLUG_EXISTS','NOT_FOUND','FORBIDDEN'])
/** Short copy for the step that failed: no internal commands unless they are the actual next action. */
export function onboardingFailureCopy(error:unknown,payload:{text?:string;form?:Record<string,string>}){
 const e=error as {name?:unknown;code?:unknown;message?:unknown}|null,command=onboardingCommand(payload.text||'')
 if(payload.form?.OnboardingInternal==='1')return e instanceof OnboardingTranslationFailure&&e.transient?'Le *traduzioni* sono in pausa: il servizio è occupato. La bozza è salva. Tra qualche minuto scrivi *PREPARA ONBOARDING* per completarle.':'Non ho completato le *traduzioni*. La bozza è salva: scrivi *PREPARA ONBOARDING* per riprovare.'
 if(typeof e?.code==='string'&&userErrorCodes.has(e.code)&&typeof e.message==='string')return e.message.slice(0,300)
 if(command==='approva e attiva')return 'Il locale *non è stato attivato*. Riprova con *APPROVA E ATTIVA*.'
 if(e?.name==='OnboardingBusy')return 'Il servizio è *occupato*: non ho letto l’ultimo messaggio. *Rimandalo* tra qualche minuto, la bozza è salva.'
 return 'Non sono riuscito a leggere l’ultimo messaggio. *Rimandalo*, la bozza è salva.'
}
/** Provider busy on a user message: the same job is retried automatically (max 2), keeping its place in the queue. */
export const onboardingBusyRetryCopy='Il servizio è *occupato*: riprovo da solo tra poco, la richiesta *non è persa*.'
const maxBusyRetries=2
async function claimOnboardingJob(actor:string,phone:string){return db.transaction(async tx=>{
 await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${`onboarding-worker:${phone}`},0))`)
 await tx.execute(sql`UPDATE tako_onboarding_inbox_jobs SET status='failed',updated_at=now() WHERE phone=${phone} AND status='running' AND updated_at<now()-interval '4 minutes'`)
 const running=await tx.execute(sql`SELECT sid FROM tako_onboarding_inbox_jobs WHERE phone=${phone} AND status='running' LIMIT 1`)
 if(running.length)return null
 const jobs=await tx.execute(sql`UPDATE tako_onboarding_inbox_jobs SET status='running',updated_at=now() WHERE sid=(SELECT sid FROM tako_onboarding_inbox_jobs WHERE actor_id=${actor} AND phone=${phone} AND status='pending' ORDER BY (sid LIKE 'OB%'),updated_at,sid LIMIT 1 FOR UPDATE SKIP LOCKED) RETURNING sid,payload`)
 return jobs[0]??null
})}
export function splitOnboardingResponse(text:string,max=1400){const chunks:string[]=[];let remaining=text;while(remaining.length>max){const cut=remaining.lastIndexOf('\n',max);const at=cut>max/2?cut:max;chunks.push(remaining.slice(0,at));remaining=remaining.slice(at).replace(/^\n/,'')}if(remaining)chunks.push(remaining);return chunks}
export async function drainOnboardingQueue(actor:string,phone:string){
 {
  // One provider-bearing job per edge invocation; hand off all remaining work.
  const job=await claimOnboardingJob(actor,phone);if(!job)return
  const payload=job.payload as {text:string;form:Record<string,string>};const sessionBefore=await activeOnboarding(actor,phone);let response:string,success=false,retryTranslation=false,busyRetry=false,busyRetryAfterMs=0,failureCause:string|undefined,diagnostic:OnboardingTranslationFailure['diagnostic']|undefined
  try{
   const voiceType=whatsappAudioType(payload.form?.MediaContentType0,payload.form?.Body??payload.text)
   if(voiceType&&payload.form.OnboardingVoice!=='1'){
    const media=await downloadTwilioMedia(payload.form.MediaUrl0||'',process.env.TWILIO_ACCOUNT_SID||'',process.env.TWILIO_AUTH_TOKEN||'',8*1024*1024,12000)
    payload.text=(await transcribeAudio(media.bytes,/^audio\//i.test(media.type)?media.type:voiceType,process.env.GROQ_API_KEY||'')).slice(0,2000)
    payload.form={...payload.form,OnboardingVoice:'1',NumMedia:'0'}
   }
   response=payload.form.OnboardingVoice==='1'&&!payload.text.trim()?'Non ho capito il *vocale*. Puoi ripeterlo o scrivermi?':await handleOnboardingChat(actor,phone,payload.text,payload.form);success=true
  }
  catch(error){retryTranslation=shouldRetryOnboardingTranslation(error,payload.form||{});if(error instanceof OnboardingTranslationFailure){diagnostic=error.diagnostic;console.warn('Onboarding translation failure',JSON.stringify({...diagnostic,retryScheduled:retryTranslation}))}
   const busyRetries=Math.max(0,Number(payload.form?.OnboardingBusyRetry||0)||0)
   busyRetry=!retryTranslation&&(error as {name?:unknown})?.name==='OnboardingBusy'&&payload.form?.OnboardingInternal!=='1'&&busyRetries<maxBusyRetries
   if(busyRetry){busyRetryAfterMs=onboardingRetryDelayMs(busyRetries,(error as {retryAfterMs?:number}).retryAfterMs);payload.form={...payload.form,OnboardingBusyRetry:String(busyRetries+1)}}
   // Every failure leaves a non-sensitive cause (quota/parse/provider/timeout/store/merge) for diagnosis.
   if(!retryTranslation){const cause=await recordOnboardingFailure(error,phone,busyRetry?`retry ${busyRetries+1}/${maxBusyRetries}`:undefined);failureCause=cause||undefined}
   // Automatic retries stay silent; the user only hears about a failure that needs them, in words of the current step.
   response=retryTranslation?(payload.form?.OnboardingInternal==='1'?'':'Le *traduzioni* richiedono qualche minuto. Ti scrivo quando l’anteprima è pronta.'):busyRetry?(busyRetries===0?onboardingBusyRetryCopy:''):onboardingFailureCopy(error,payload)}
  const current=success?await activeOnboarding(actor,phone):null
  const count=current?.data.workspace.menus.reduce((n,m)=>n+m.sections.reduce((a,c)=>a+c.items.length,0),0)||0
  const pending=current?pendingOnboardingTranslations(current.data.workspace).length:0
  const rawAttempt=Number(payload.form?.OnboardingAttempt||0),attempts=Number.isSafeInteger(rawAttempt)&&rawAttempt>=0?rawAttempt:256
  // Translations start only once the questions are answered: on the free Groq tier (8000 tokens/min) a background
  // translation chain made the user's own next answer fail with 429 («Non ho completato il passaggio»).
  const more=!!current&&!current.data.paused&&attempts<256&&(pendingOnboardingSources(current.data)||count>0&&current.data.unresolved.length===0&&pending>0&&expectedOnboardingField(current.data)===null)
  // Intermediate automatic chunks stay quiet. The first and final messages show real progress.
  const canReply=!success||!sessionBefore||current?.id===sessionBefore.id||/^(approva e attiva|annulla onboarding|esci onboarding)$/.test(onboardingCommand(payload.text))
  if(response&&!(payload.form?.OnboardingInternal==='1'&&more)&&canReply)try{for(const part of splitOnboardingResponse(response))await sendWhatsApp(process.env.TWILIO_ACCOUNT_SID||'',process.env.TWILIO_AUTH_TOKEN||'',process.env.TWILIO_WHATSAPP_NUMBER||'',phone,part);const qr=response.match(/https:\/\/takoitalia\.com\/api\/onboarding\/owner-qr\/[a-f0-9]{64}/)?.[0];if(qr)await sendOwnerInviteQr(phone,qr)}catch{success=false}
  const next=retryTranslation||more&&success&&current?'OB'+randomBytes(16).toString('hex'):null
  const retries=onboardingTranslationRetries(payload.form||{}),nextPayload={text:'prepara onboarding',form:{OnboardingInternal:'1',OnboardingAttempt:String(attempts+1),...(retryTranslation?{OnboardingTranslationRetry:String(retries+1)}:{})}}
  const closed=success&&/^(approva e attiva|annulla onboarding)$/.test(onboardingCommand(payload.text||'')),noticed=success&&expiredNoticeOpenings.some(x=>response.startsWith(x))
  // Keep this worker running until the continuation is durable. A concurrent delivery
  // can neither claim the next user message nor race a session revision update.
  const pendingJob=await db.transaction(async tx=>{
   await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${`onboarding-worker:${phone}`},0))`)
   // One automatic continuation per phone: parallel chains duplicated every translation message.
   if(next)await tx.execute(sql`INSERT INTO tako_onboarding_inbox_jobs(sid,actor_id,phone,payload,session_id) SELECT ${next},${actor},${phone},${JSON.stringify(nextPayload)}::jsonb,${current?.id||sessionBefore?.id||null} WHERE NOT EXISTS(SELECT 1 FROM tako_onboarding_inbox_jobs WHERE phone=${phone} AND status='pending' AND sid LIKE 'OB%')`)
   // A busy retry goes back to pending without touching updated_at, so it keeps its turn before newer messages.
   if(busyRetry)await tx.execute(sql`UPDATE tako_onboarding_inbox_jobs SET status='pending',payload=${JSON.stringify({...payload,diagnostic:{cause:failureCause||'quota'}})}::jsonb WHERE sid=${String(job.sid)} AND status='running'`)
   else await tx.execute(sql`UPDATE tako_onboarding_inbox_jobs SET status=${success||retryTranslation?'done':'failed'},payload=${JSON.stringify(success||retryTranslation?{...(diagnostic?{diagnostic}:{}),...(closed?{closed:true}:{}),...(noticed?{expiredNotice:true}:{})}:{...payload,diagnostic:diagnostic??{cause:failureCause||'other'}})}::jsonb,updated_at=now() WHERE sid=${String(job.sid)} AND (status='running' OR ${closed})`)
   const queued=await tx.execute(sql`SELECT sid FROM tako_onboarding_inbox_jobs WHERE actor_id=${actor} AND phone=${phone} AND status='pending' ORDER BY (sid LIKE 'OB%'),updated_at,sid LIMIT 1`)
   return queued[0]?.sid?String(queued[0].sid):null
  })
  // Select the oldest queued message, not necessarily our translation continuation.
  // A network failure leaves the durable pending row available to RIPRENDI.
  // A provider rate limit is waited out before the retry runs (backoff, bounded); user messages are dispatched at once.
  if(pendingJob&&pendingJob===next&&retryTranslation)await new Promise(r=>setTimeout(r,onboardingRetryDelayMs(retries,diagnostic?.retryAfterMs)))
  if(pendingJob&&busyRetry&&busyRetryAfterMs)await new Promise(r=>setTimeout(r,busyRetryAfterMs))
  if(pendingJob)await dispatchOnboardingJob(pendingJob)
 }
}
/** Reserved after signature validation. Explicit RIPRENDI replays the failed payload, including media URLs. */
export async function queueOnboardingChat(actor:string,phone:string,sid:string,text:string,form:Record<string,string>){
 const inserted=await db.execute(sql`INSERT INTO tako_onboarding_inbox_jobs(sid,actor_id,phone,payload,session_id) VALUES(${sid},${actor},${phone},${JSON.stringify({text,form})}::jsonb,(SELECT id FROM tako_onboarding_sessions WHERE actor_id=${actor} AND phone=${phone} AND state IN('collecting','review') AND expires_at>now() AND (data->>'paused') IS DISTINCT FROM 'true' LIMIT 1)) ON CONFLICT DO NOTHING RETURNING sid`)
 if(!inserted.length)return false
 if(/^riprendi(?: [a-f0-9-]{36})?$/i.test(text.trim()))await db.transaction(async tx=>{
  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${`onboarding-worker:${phone}`},0))`)
  await tx.execute(sql`UPDATE tako_onboarding_inbox_jobs SET status='failed',updated_at=now() WHERE actor_id=${actor} AND phone=${phone} AND status='running' AND updated_at<now()-interval '4 minutes'`)
  const failed=await tx.execute(sql`SELECT sid,payload FROM tako_onboarding_inbox_jobs WHERE actor_id=${actor} AND phone=${phone} AND status='failed' AND sid<>${sid} ORDER BY updated_at LIMIT 1 FOR UPDATE`)
  if(failed[0]){await tx.execute(sql`UPDATE tako_onboarding_inbox_jobs SET payload=${JSON.stringify(failed[0].payload)}::jsonb WHERE sid=${sid}`);await tx.execute(sql`UPDATE tako_onboarding_inbox_jobs SET status='done',payload='{}'::jsonb,updated_at=now() WHERE sid=${String(failed[0].sid)}`)}
 })
 const run=drainOnboardingQueue(actor,phone).catch(()=>{console.error('Onboarding queue stopped; persisted jobs retained for resume')}),runtime=(globalThis as any).EdgeRuntime
 if(runtime?.waitUntil)runtime.waitUntil(run);else await run
 return true
}
