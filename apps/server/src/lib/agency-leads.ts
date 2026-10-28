import {randomUUID,createHash} from 'node:crypto'
import {db} from '@tako/db'
import {sql} from 'drizzle-orm'
import {z} from 'zod'
import {workspaceSchema} from './menu-workspace-contract.js'
import {foodCatalogs} from './menu-workspace-catalogs.js'
import {publicWorkspace} from './menu-workspace-schedule.js'
/** «Prova attiva»: il locale PROVA collegato diventa pubblicabile (takomenuTrial=false) nella stessa transazione.
 * «Rifiutato» (not_interested) con removeTrial: il locale PROVA viene disattivato in modo recuperabile
 * (active=false + takomenuRemoved*), solo se takomenuTrial=true. Vedi docs/webapp/feature-vendita-2026-10-16/lead-stati-automatici.md */
/** PROVA rimovibile: locale creato dalla campagna per QUESTO lead (trialLeadId) e ancora in prova — bloccato
 * (takomenuTrial=true) oppure sbloccato solo dall'automatismo «Prova attiva» (trialActivatedAt) — e lead non Cliente.
 * Un locale cliente vero (senza trialLeadId, o lead in stato Cliente) non si rimuove mai da qui. */
export function removableTrial(settings:any,leadId:string,leadStatus:string){return !!settings&&settings.trialLeadId===leadId&&leadStatus!=='customer'&&(settings.takomenuTrial===true||(settings.takomenuTrial===false&&typeof settings.trialActivatedAt==='string'))}
export const TRIAL_ACTIVE_STATUS='trial',REJECTED_STATUS='not_interested'
export const LEAD_STATUSES=['new','qualified','demo_preparing','demo_ready','to_call','contacted','interested','trial','follow_up','customer','not_interested'] as const
const revision=z.number().int().min(1),short=z.string().trim().max(200)
export const leadPatchSchema=z.object({revision,status:z.enum(LEAD_STATUSES).optional(),removeTrial:z.literal(true).optional(),notes:z.string().trim().max(20000).optional(),assignee:short.optional(),nextContactAt:z.string().datetime({offset:true}).nullable().optional()}).strict().refine(v=>Object.keys(v).length>1,'Nessuna modifica indicata').refine(v=>!v.removeTrial||v.status===REJECTED_STATUS,'La rimozione accompagna solo lo stato Rifiutato')
export const leadActivitySchema=z.object({revision,type:z.enum(['call','message','note']),outcome:z.string().trim().max(120).default(''),text:z.string().trim().max(10000).default('')}).strict().refine(v=>v.type!=='note'||v.text.length>0,'Inserisci una nota')
export type LeadPatch=z.infer<typeof leadPatchSchema>
export type LeadActivityInput=z.infer<typeof leadActivitySchema>
const iso=(v:any)=>v instanceof Date?v.toISOString():v||null
export function agencyLead(row:any){return {id:String(row.id),sourceId:String(row.source_id),source:row.source||{},status:row.status,notes:row.notes||'',assignee:row.assignee||'',nextContactAt:iso(row.next_contact_at),restaurantId:row.restaurant_id||null,revision:Number(row.revision),updatedAt:iso(row.updated_at),lastCalledAt:iso(row.last_called_at),lastMessagedAt:iso(row.last_messaged_at),callCount:Number(row.call_count||0),messageCount:Number(row.message_count||0)}}
export function agencyLeadActivity(row:any){return{id:row.id,leadId:row.lead_id,type:row.type,outcome:row.outcome||'',text:row.text||'',actorId:row.actor_id,createdAt:iso(row.created_at)}}
export class LeadError extends Error{constructor(public code:'NOT_FOUND'|'REVISION_CONFLICT'|'NOT_TRIAL'){super(code)}}
const listQuery=sql`SELECT l.*, (SELECT max(a.created_at) FROM tako_agency_lead_activities a WHERE a.lead_id=l.id AND a.type='call') AS last_called_at,(SELECT max(a.created_at) FROM tako_agency_lead_activities a WHERE a.lead_id=l.id AND a.type='message') AS last_messaged_at,(SELECT count(*)::int FROM tako_agency_lead_activities a WHERE a.lead_id=l.id AND a.type='call') AS call_count,(SELECT count(*)::int FROM tako_agency_lead_activities a WHERE a.lead_id=l.id AND a.type='message') AS message_count FROM tako_agency_leads l ORDER BY l.source_id,l.id`
export function createAgencyLeadStore(connection:Pick<typeof db,'execute'|'transaction'>=db){return {
 async preview(token:string){
  const hash=createHash('sha256').update(token).digest('hex')
  const row=(await connection.execute(sql`SELECT r.name,w.draft,w.revision,l.source->>'demoSourceNote' AS source_note FROM tako_agency_leads l JOIN restaurants r ON r.id=l.restaurant_id JOIN menu_workspaces w ON w.restaurant_id=r.id WHERE l.demo_token_hash=${hash} AND r.active=true AND (r.settings->>'takomenuTrial'='true' OR r.settings->>'trialLeadId'=l.id) LIMIT 1`))[0]
  if(!row)throw new LeadError('NOT_FOUND')
  const parsed=workspaceSchema.safeParse(row.draft);if(!parsed.success)throw new LeadError('NOT_FOUND')
  return{data:{name:String(row.name),workspace:publicWorkspace(parsed.data,new Date(),{ignoreSchedules:true}),revision:Number(row.revision),warnings:[],unresolved:[],isTrial:true,sourceNote:String(row.source_note||'Menu dimostrativo da verificare con il locale.'),presentation:{restaurantName:String(row.name),foodCatalogs}}}
 },
 async list(){return (await connection.execute(listQuery)).map(agencyLead)},
 async detail(id:string){const row=(await this.list()).find(r=>r.id===id);if(!row)throw new LeadError('NOT_FOUND');const activities=await connection.execute(sql`SELECT * FROM tako_agency_lead_activities WHERE lead_id=${id} ORDER BY created_at DESC,id DESC LIMIT 300`);return{data:{...row,activities:activities.map(agencyLeadActivity)}}},
 async patch(id:string,input:LeadPatch,actorId:string|null=null){await connection.transaction(async tx=>{const row=(await tx.execute(sql`SELECT revision,status,restaurant_id FROM tako_agency_leads WHERE id=${id} FOR UPDATE`))[0];if(!row)throw new LeadError('NOT_FOUND');if(Number(row.revision)!==input.revision)throw new LeadError('REVISION_CONFLICT')
  const restaurantId=row.restaurant_id?String(row.restaurant_id):null,changed=input.status!==undefined&&input.status!==row.status
  if(input.removeTrial){const r=restaurantId?(await tx.execute(sql`SELECT settings FROM restaurants WHERE id=${restaurantId} FOR UPDATE`))[0]:null;if(!r||!removableTrial(r.settings,id,String(row.status)))throw new LeadError('NOT_TRIAL')
   await tx.execute(sql`UPDATE restaurants SET active=false,settings=settings||jsonb_build_object('takomenuRemoved',true,'takomenuRemovedAt',now()::text,'takomenuRemovedBy',${actorId}::text,'takomenuRemovedLeadId',${id}::text,'takomenuRemovedPreviousActive',active),updated_at=now() WHERE id=${restaurantId}`)
   // Le sessioni posizionate su questo locale tornano al proprio locale (altrimenti «Accesso al locale revocato»).
   await tx.execute(sql`DELETE FROM web_session_locations WHERE restaurant_id=${restaurantId}`)}
  await tx.execute(sql`UPDATE tako_agency_leads SET status=coalesce(${input.status??null},status),notes=coalesce(${input.notes??null},notes),assignee=coalesce(${input.assignee??null},assignee),next_contact_at=CASE WHEN ${'nextContactAt' in input} THEN ${input.nextContactAt??null}::timestamptz ELSE next_contact_at END,revision=revision+1,updated_at=now() WHERE id=${id}`)
  if(changed&&input.status===TRIAL_ACTIVE_STATUS&&restaurantId)await tx.execute(sql`UPDATE restaurants SET settings=settings||jsonb_build_object('takomenuTrial',false,'trialActivatedAt',now()::text,'trialActivatedBy',${actorId}::text),updated_at=now() WHERE id=${restaurantId} AND active=true AND settings->>'takomenuTrial'='true'`)
  // Tornare indietro da «Prova attiva» non riblocca il locale: resta pubblicabile, lo annotiamo nel CRM.
  if(changed&&row.status===TRIAL_ACTIVE_STATUS&&restaurantId&&actorId){const r=(await tx.execute(sql`SELECT 1 FROM restaurants WHERE id=${restaurantId} AND settings->>'takomenuTrial'='false' AND settings ? 'trialActivatedAt'`))[0];if(r)await tx.execute(sql`INSERT INTO tako_agency_lead_activities(id,lead_id,type,outcome,text,actor_id) VALUES(${randomUUID()},${id},'note','Stato cambiato','Il lead non è più in «Prova attiva», ma il locale resta pubblicabile: il blocco della prova non si riattiva da solo.',${actorId})`)}
 });return{data:(await this.detail(id)).data}},
 async activity(id:string,input:LeadActivityInput,actorId:string){const activity=await connection.transaction(async tx=>{const row=(await tx.execute(sql`SELECT revision FROM tako_agency_leads WHERE id=${id} FOR UPDATE`))[0];if(!row)throw new LeadError('NOT_FOUND');if(Number(row.revision)!==input.revision)throw new LeadError('REVISION_CONFLICT');const rows=await tx.execute(sql`INSERT INTO tako_agency_lead_activities(id,lead_id,type,outcome,text,actor_id) VALUES(${randomUUID()},${id},${input.type},${input.outcome},${input.text},${actorId}) RETURNING *`);await tx.execute(sql`UPDATE tako_agency_leads SET revision=revision+1,updated_at=now() WHERE id=${id}`);return agencyLeadActivity(rows[0])});return{data:{...(await this.detail(id)).data,activity}}}
}}
export const agencyLeadStore=createAgencyLeadStore()
