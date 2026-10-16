import {randomUUID,createHash} from 'node:crypto'
import {db} from '@tako/db'
import {sql} from 'drizzle-orm'
import {z} from 'zod'
import {workspaceSchema} from './menu-workspace-contract.js'
import {foodCatalogs} from './menu-workspace-catalogs.js'
import {publicWorkspace} from './menu-workspace-schedule.js'
export const LEAD_STATUSES=['new','qualified','demo_preparing','demo_ready','to_call','contacted','interested','trial','follow_up','customer','not_interested'] as const
const revision=z.number().int().min(1),short=z.string().trim().max(200)
export const leadPatchSchema=z.object({revision,status:z.enum(LEAD_STATUSES).optional(),notes:z.string().trim().max(20000).optional(),assignee:short.optional(),nextContactAt:z.string().datetime({offset:true}).nullable().optional()}).strict().refine(v=>Object.keys(v).length>1,'Nessuna modifica indicata')
export const leadActivitySchema=z.object({revision,type:z.enum(['call','message','note']),outcome:z.string().trim().max(120).default(''),text:z.string().trim().max(10000).default('')}).strict().refine(v=>v.type!=='note'||v.text.length>0,'Inserisci una nota')
export type LeadPatch=z.infer<typeof leadPatchSchema>
export type LeadActivityInput=z.infer<typeof leadActivitySchema>
const iso=(v:any)=>v instanceof Date?v.toISOString():v||null
export function agencyLead(row:any){return {id:String(row.id),sourceId:String(row.source_id),source:row.source||{},status:row.status,notes:row.notes||'',assignee:row.assignee||'',nextContactAt:iso(row.next_contact_at),restaurantId:row.restaurant_id||null,revision:Number(row.revision),updatedAt:iso(row.updated_at),lastCalledAt:iso(row.last_called_at),lastMessagedAt:iso(row.last_messaged_at),callCount:Number(row.call_count||0),messageCount:Number(row.message_count||0)}}
export function agencyLeadActivity(row:any){return{id:row.id,leadId:row.lead_id,type:row.type,outcome:row.outcome||'',text:row.text||'',actorId:row.actor_id,createdAt:iso(row.created_at)}}
export class LeadError extends Error{constructor(public code:'NOT_FOUND'|'REVISION_CONFLICT'){super(code)}}
const listQuery=sql`SELECT l.*, (SELECT max(a.created_at) FROM tako_agency_lead_activities a WHERE a.lead_id=l.id AND a.type='call') AS last_called_at,(SELECT max(a.created_at) FROM tako_agency_lead_activities a WHERE a.lead_id=l.id AND a.type='message') AS last_messaged_at,(SELECT count(*)::int FROM tako_agency_lead_activities a WHERE a.lead_id=l.id AND a.type='call') AS call_count,(SELECT count(*)::int FROM tako_agency_lead_activities a WHERE a.lead_id=l.id AND a.type='message') AS message_count FROM tako_agency_leads l ORDER BY l.source_id,l.id`
export function createAgencyLeadStore(connection:Pick<typeof db,'execute'|'transaction'>=db){return {
 async preview(token:string){
  const hash=createHash('sha256').update(token).digest('hex')
  const row=(await connection.execute(sql`SELECT r.name,w.draft,w.revision,l.source->>'demoSourceNote' AS source_note FROM tako_agency_leads l JOIN restaurants r ON r.id=l.restaurant_id JOIN menu_workspaces w ON w.restaurant_id=r.id WHERE l.demo_token_hash=${hash} AND r.active=true AND r.settings->>'takomenuTrial'='true' LIMIT 1`))[0]
  if(!row)throw new LeadError('NOT_FOUND')
  const parsed=workspaceSchema.safeParse(row.draft);if(!parsed.success)throw new LeadError('NOT_FOUND')
  return{data:{name:String(row.name),workspace:publicWorkspace(parsed.data,new Date(),{ignoreSchedules:true}),revision:Number(row.revision),warnings:[],unresolved:[],isTrial:true,sourceNote:String(row.source_note||'Menu dimostrativo da verificare con il locale.'),presentation:{restaurantName:String(row.name),foodCatalogs}}}
 },
 async list(){return (await connection.execute(listQuery)).map(agencyLead)},
 async detail(id:string){const row=(await this.list()).find(r=>r.id===id);if(!row)throw new LeadError('NOT_FOUND');const activities=await connection.execute(sql`SELECT * FROM tako_agency_lead_activities WHERE lead_id=${id} ORDER BY created_at DESC,id DESC LIMIT 300`);return{data:{...row,activities:activities.map(agencyLeadActivity)}}},
 async patch(id:string,input:LeadPatch){await connection.transaction(async tx=>{const row=(await tx.execute(sql`SELECT revision FROM tako_agency_leads WHERE id=${id} FOR UPDATE`))[0];if(!row)throw new LeadError('NOT_FOUND');if(Number(row.revision)!==input.revision)throw new LeadError('REVISION_CONFLICT');await tx.execute(sql`UPDATE tako_agency_leads SET status=coalesce(${input.status??null},status),notes=coalesce(${input.notes??null},notes),assignee=coalesce(${input.assignee??null},assignee),next_contact_at=CASE WHEN ${'nextContactAt' in input} THEN ${input.nextContactAt??null}::timestamptz ELSE next_contact_at END,revision=revision+1,updated_at=now() WHERE id=${id}`)});return{data:(await this.detail(id)).data}},
 async activity(id:string,input:LeadActivityInput,actorId:string){const activity=await connection.transaction(async tx=>{const row=(await tx.execute(sql`SELECT revision FROM tako_agency_leads WHERE id=${id} FOR UPDATE`))[0];if(!row)throw new LeadError('NOT_FOUND');if(Number(row.revision)!==input.revision)throw new LeadError('REVISION_CONFLICT');const rows=await tx.execute(sql`INSERT INTO tako_agency_lead_activities(id,lead_id,type,outcome,text,actor_id) VALUES(${randomUUID()},${id},${input.type},${input.outcome},${input.text},${actorId}) RETURNING *`);await tx.execute(sql`UPDATE tako_agency_leads SET revision=revision+1,updated_at=now() WHERE id=${id}`);return agencyLeadActivity(rows[0])});return{data:{...(await this.detail(id)).data,activity}}}
}}
export const agencyLeadStore=createAgencyLeadStore()
