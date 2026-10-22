// Innesto «menu intero» nel bot titolare (Feature 1). Chiamato da menuTurn prima del flusso delle modifiche singole:
// restituisce null quando il messaggio non riguarda il menu intero, così tutto il resto si comporta come prima.
// Stati nella stessa riga di tako_whatsapp_proposals (jsonb, nessuna migrazione): doubt → where → confirm, oppure replay.
import {sql} from 'drizzle-orm'
import type {DB} from '@tako/db'
import {applyBotChange} from './menu-workspace-bot.js'
import {workspaceSchema,type Workspace} from './menu-workspace-contract.js'
import {safe,type MenuRef} from './twilio-menu-ai.js'
import {copy,fullMenuCopy,fill} from './twilio-menu-copy.js'
import {fullMenuSignal,readDestination,resolveDestination,whereQuestion,isDestinationAnswer,fullMenuSummary,applyCorrections,type Destination,type FullMenuProposal} from './menu-full-flow.js'
import {replaceMenuContent,buildMenuContent,restoreMenuFrom} from './menu-replace.js'
import type {FullMenuExtraction} from './menu-full-extract.js'
import {menuPresetTarget} from './menu-preset-target.js'
import {enqueueNewTextTranslations} from './menu-translation-queue.js'
import {contentMenus} from './menu-full-flow.js'

type Tx={execute:(query:any)=>Promise<any[]>}
type Ctx={phone:string,tenant:string,actor:string}
export type FullMenuJob={text:string,destination:Destination,voice?:boolean}
export type FullMenuTurn=string|{llm:true,text?:string,fullmenu?:FullMenuJob}
export const fullMenuMinutes=30
export const snapshotLabel='WhatsApp: copia prima del menu intero #',restoredLabel='WhatsApp: menu di prima ripristinato #'
const plain=(s:string)=>s.normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim()
const restoreRe=/\b(?:ripristin\w*|rimett\w*|torn\w*(?:\s+\w+)?\s+a[l]?)\s+(?:il\s+|al\s+)?menu\s+(?:di\s+prima|precedente|vecchio|di\s+ieri)\b/
export const wantsRestore=(text:string)=>restoreRe.test(plain(text))

const proposeFull=(tx:Tx,ctx:Ctx,revision:number,command:FullMenuProposal)=>tx.execute(sql`INSERT INTO tako_whatsapp_proposals(phone,restaurant_id,actor_id,revision,command,expires_at) VALUES(${ctx.phone},${ctx.tenant},${ctx.actor},${revision},${JSON.stringify(command)}::jsonb,now()+interval '30 minutes') ON CONFLICT(phone) DO UPDATE SET restaurant_id=EXCLUDED.restaurant_id,actor_id=EXCLUDED.actor_id,revision=EXCLUDED.revision,command=EXCLUDED.command,expires_at=EXCLUDED.expires_at`)
const dropProposal=(tx:Tx,ctx:Ctx)=>tx.execute(sql`DELETE FROM tako_whatsapp_proposals WHERE phone=${ctx.phone}`)
async function presetMenus(tx:Tx,tenant:string,w:Workspace){const out=new Set<string>();for(const m of contentMenus(w))if(await menuPresetTarget.enabled(tx,tenant,m.id).catch(()=>false))out.add(m.id);return out}
async function restaurantName(tx:Tx,tenant:string){const rows=await tx.execute(sql`SELECT name FROM restaurants WHERE id=${tenant}`);return String(rows[0]?.name??'')}
const expired=(isExpired?:()=>boolean)=>{if(isExpired?.())throw new Error('WhatsApp turn expired')}

export async function fullMenuTurn(tx:Tx,ctx:Ctx,text:string,o:{revision:number,workspace:Workspace,refs:MenuRef[],reply:'confirm'|'cancel'|null,normalized:string,voice?:boolean,timezone:string,plannedFull?:{revision:number,job:FullMenuJob,extraction:FullMenuExtraction},isExpired?:()=>boolean}):Promise<FullMenuTurn|null>{
 const w=o.workspace
 // A) the extraction came back from the job: store the draft and show the complete summary (always, text or voice).
 if(o.plannedFull){
  const {job,extraction}=o.plannedFull;if(o.plannedFull.revision!==o.revision)return copy.menuChanged
  if(!w.menus.some(m=>m.id===job.destination.menuId))return copy.menuChanged
  if(!extraction.rows.length){await dropProposal(tx,ctx);return fullMenuCopy.empty}
  await proposeFull(tx,ctx,o.revision,{kind:'fullmenu',stage:'confirm',text:job.text,...(job.voice?{voice:true}:{}),destination:job.destination,rows:extraction.rows,missing:extraction.missing,issues:extraction.issues,requiresTypedOk:true})
  return summaryFor(tx,ctx,w,{destination:job.destination,rows:extraction.rows,missing:extraction.missing,issues:extraction.issues,voice:job.voice})
 }
 if(wantsRestore(text))return restore(tx,ctx,w,o.revision,o.isExpired)
 const proposals=await tx.execute(sql`SELECT command,revision FROM tako_whatsapp_proposals WHERE phone=${ctx.phone} AND actor_id=${ctx.actor} AND restaurant_id=${ctx.tenant} AND expires_at>now() FOR UPDATE`)
 const proposal=proposals[0],full=(proposal?.command as any)?.kind==='fullmenu'?proposal!.command as FullMenuProposal:null
 const signal=()=>fullMenuSignal(text,o.refs)
 // B) a full-menu conversation is open.
 if(full){
  if(Number(proposal!.revision)!==o.revision){await dropProposal(tx,ctx);return copy.menuChanged}
  if(full.stage==='confirm'){
   if(o.reply==='confirm'){if(o.voice||o.normalized!=='ok')return copy.typedOk;return apply(tx,ctx,w,o.revision,full,o.isExpired)}
   if(signal()!=='full'){
    const fixed=applyCorrections(text,full.rows??[],full.missing??[])
    if(!fixed.done.length)return fixed.failed.length&&fixed.failed.join(' ').length<=200?fill(fullMenuCopy.fixFailed,{testo:fixed.failed.join(', ').slice(0,120)})+'\n\n'+fullMenuCopy.pending:fullMenuCopy.pending
    if(!fixed.rows.length)return fullMenuCopy.noRows
    await proposeFull(tx,ctx,o.revision,{...full,rows:fixed.rows,missing:fixed.missing})
    const failed=fixed.failed.length?'\n'+fill(fullMenuCopy.fixFailed,{testo:fixed.failed.join(', ').slice(0,120)}):''
    return fill(fullMenuCopy.fixDone,{modifiche:fixed.done.join(', ')})+failed+'\n\n'+await summaryFor(tx,ctx,w,{destination:full.destination!,rows:fixed.rows,missing:fixed.missing,issues:full.issues??[],voice:full.voice})
   }
   // a new complete menu replaces the draft (below)
  }else if(full.stage==='where'){
   if(o.reply==='confirm'||isDestinationAnswer(text,w)){
    const presets=await presetMenus(tx,ctx.tenant,w),partial=readDestination(text,w,full.partial??{},{timezone:o.timezone});if(o.reply==='confirm')partial.mode='replace'
    const r=resolveDestination(partial,w,presets)
    if('destination' in r)return{llm:true,fullmenu:{text:full.text,destination:r.destination,...(full.voice?{voice:true}:{})}}
    if((full.asked??0)>=2){await dropProposal(tx,ctx);return fullMenuCopy.failed}
    await proposeFull(tx,ctx,o.revision,{...full,partial,asked:(full.asked??0)+1});return whereQuestion(r.need,presets.size>0)
   }
   await dropProposal(tx,ctx) // the owner moved on: the question is dropped, the message follows its normal path
  }else if(full.stage==='doubt'){
   if(/\b(menu|completo|intero|sostituisci\w*)\b/.test(o.normalized))return startDestination(tx,ctx,w,o.revision,full.text,full.voice,o.timezone)
   if(/\bmodific\w*\b/.test(o.normalized)){await proposeFull(tx,ctx,o.revision,{...full,stage:'replay',answer:o.normalized});return{llm:true,text:full.text}}
   if(signal()!=='full')return fullMenuCopy.doubtAgain
  }else if(full.stage==='replay'){
   if(o.normalized===full.answer)return{llm:true,text:full.text}
   await dropProposal(tx,ctx)
  }
 }
 // C) a new message.
 const kind=signal();if(!kind)return null
 if(kind==='doubt'){await proposeFull(tx,ctx,o.revision,{kind:'fullmenu',stage:'doubt',text,...(o.voice?{voice:true}:{})});return fullMenuCopy.doubt}
 return startDestination(tx,ctx,w,o.revision,text,o.voice,o.timezone)
}

async function startDestination(tx:Tx,ctx:Ctx,w:Workspace,revision:number,text:string,voice:boolean|undefined,timezone:string):Promise<FullMenuTurn>{
 const presets=await presetMenus(tx,ctx.tenant,w),partial=readDestination(text,w,{},{timezone}),r=resolveDestination(partial,w,presets)
 if('destination' in r){return{llm:true,fullmenu:{text,destination:r.destination,...(voice?{voice:true}:{})}}}
 await proposeFull(tx,ctx,revision,{kind:'fullmenu',stage:'where',text,...(voice?{voice:true}:{}),partial,asked:0})
 return whereQuestion(r.need,presets.size>0)
}

async function summaryFor(tx:Tx,ctx:Ctx,w:Workspace,p:{destination:Destination,rows:any[],missing:any[],issues:string[],voice?:boolean}){
 const diff=p.destination.kind==='replace'?replaceMenuContent(w,p.destination.menuId,p.rows).summary:null
 return fullMenuSummary({restaurant:await restaurantName(tx,ctx.tenant),destination:p.destination,workspace:w,rows:p.rows,missing:p.missing,issues:p.issues,voice:p.voice,diff})
}

async function apply(tx:Tx,ctx:Ctx,w:Workspace,revision:number,full:FullMenuProposal,isExpired?:()=>boolean):Promise<string>{
 const d=full.destination,rows=full.rows??[];if(!d||!rows.length){await dropProposal(tx,ctx);return fullMenuCopy.noRows}
 const menu=w.menus.find(m=>m.id===d.menuId);if(!menu){await dropProposal(tx,ctx);return copy.menuChanged}
 const missing=(full.missing??[]).length?fill(fullMenuCopy.appliedMissing,{piatti:(full.missing??[]).map(m=>'*'+safe(m.name.charAt(0).toLocaleUpperCase('it')+m.name.slice(1))+'*').join(', ')}):''
 if(d.kind==='preset'){
  const built=buildMenuContent(menu,rows);expired(isExpired)
  const saved=await menuPresetTarget.save(tx,{restaurantId:ctx.tenant,actorId:ctx.actor,destination:d,sections:built.sections})
  await dropProposal(tx,ctx);void enqueueNewTextTranslations(ctx.tenant,built.summary.newTexts).catch(()=>{})
  return fill(fullMenuCopy.savedPreset,{preset:saved.label})+missing.replace('online','nel preset')
 }
 const {workspace:changed,summary}=replaceMenuContent(w,d.menuId,rows),next=workspaceSchema.parse(changed),connection=tx as unknown as DB
 // Safety copy first (a labelled version of the menu as it is now), then draft, then publication: one transaction.
 // dashboard editor 22/10: solo quel Menu, in pubblicato e bozza; se la bozza di quel Menu aveva modifiche, prima se ne salva una versione + avviso.
 expired(isExpired);await applyBotChange(ctx.tenant,ctx.actor,['WhatsApp: menu intero (bozza)','WhatsApp: menu intero pubblicato'],{expectedPublishedRevision:revision,next,replaceMenuIds:[d.menuId],before:[{label:snapshotLabel+d.menuId,doc:workspaceSchema.parse(w)}],draftBackupLabel:'Bozza prima di WhatsApp (menu intero '+menu.name+')',notice:'Da WhatsApp è arrivato il menu intero «'+menu.name+'»: le modifiche non pubblicate di quel Menu sono state sostituite. Le trovi in Storico versioni.'},connection)
 expired(isExpired);await dropProposal(tx,ctx)
 // Translations never block the publication: only NEW texts are queued; the public menu shows Italian meanwhile.
 void enqueueNewTextTranslations(ctx.tenant,summary.newTexts).catch(()=>{})
 return fill(fullMenuCopy.applied,{menu:menu.name,piatti:rows.length,nuovi:summary.created.length,aggiornati:summary.updated.length,nascosti:summary.hidden.length,senzaPrezzo:missing})
}

async function restore(tx:Tx,ctx:Ctx,w:Workspace,revision:number,isExpired?:()=>boolean):Promise<string>{
 const rows=await tx.execute(sql`SELECT revision,label,snapshot FROM menu_workspace_versions WHERE restaurant_id=${ctx.tenant} AND (label LIKE ${snapshotLabel+'%'} OR label LIKE ${restoredLabel+'%'}) ORDER BY revision DESC LIMIT 1`)
 const last=rows[0];if(!last)return fullMenuCopy.restoreNone
 const label=String(last.label);if(label.startsWith(restoredLabel))return fullMenuCopy.restoreDone
 const menuId=label.slice(snapshotLabel.length),parsed=workspaceSchema.safeParse(last.snapshot);if(!parsed.success)return fullMenuCopy.restoreNone
 const restored=restoreMenuFrom(w,parsed.data,menuId);if(!restored)return fullMenuCopy.restoreNone
 const next=workspaceSchema.parse(restored),connection=tx as unknown as DB,name=w.menus.find(m=>m.id===menuId)?.name??'Menu'
 expired(isExpired);await applyBotChange(ctx.tenant,ctx.actor,['WhatsApp: ripristino menu di prima (bozza)',restoredLabel+menuId],{expectedPublishedRevision:revision,next,replaceMenuIds:[menuId],draftBackupLabel:'Bozza prima di WhatsApp (ripristino '+name+')',notice:'Da WhatsApp è stato ripristinato il menu di prima «'+name+'»: le modifiche non pubblicate di quel Menu sono state sostituite. Le trovi in Storico versioni.'},connection)
 await dropProposal(tx,ctx)
 return fill(fullMenuCopy.restored,{menu:name})
}
