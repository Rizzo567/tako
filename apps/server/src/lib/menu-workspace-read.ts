// Letture del workspace menu condivise tra la route Fastify (servizio operativo) e la
// read-edge (lib/edge-read-handler.ts). UNA sola implementazione del corpo di risposta:
// le due strade non possono divergere. Nessuna scrittura qui dentro.
import { workspaceSchema } from './menu-workspace-contract.js'
import { workspaceDiff } from './menu-workspace-schedule.js'
import type { WorkspaceRow } from './menu-workspace-store.js'

/** Corpo di GET /api/menu-workspace/publish/diff: differenze bozza ↔ pubblicato + revisioni + conflitti bot (sempre un array). */
export function publishDiffBody(row: WorkspaceRow) {
 const draft=workspaceSchema.parse(row.draft)
 // botConflicts (22/10): modifiche da WhatsApp online ma non in bozza; la dashboard le mostra prima del clic su Pubblica.
 return {data:{...workspaceDiff(row.published?workspaceSchema.parse(row.published):workspaceSchema.parse({menus:[]}),draft),botConflicts:(draft.botConflicts??[]).map(({kind,id,name,reason,at})=>({kind,id,name,reason,at})),revision:row.revision,publishedRevision:row.published_revision}}
}

// ── Dashboard editor 22/10 ──
import { db, type DB } from '@tako/db'
import { sql } from 'drizzle-orm'
import { commonMenuLanguages } from './menu-workspace-languages.js'
import { foodCatalogs } from './menu-workspace-catalogs.js'
import { pendingOf } from './menu-workspace-pending.js'
/** Flag per locale del nuovo editor «Piatti» (default spento). */
export const dashboardEditorEnabled=(settings:unknown)=>!!settings&&typeof settings==='object'&&(settings as {dashboardEditor?:unknown}).dashboardEditor===true
/** pending per contenuto NORMALIZZATO: se le colonne grezze differiscono si confrontano i documenti passati da zod
 * (un documento salvato prima di un campo con default non è «modificato»). Parse solo quando il confronto grezzo dice «diverso». */
export function pendingNormalized(row:{draft:unknown;published:unknown}){
 if(!pendingOf(row)||row.published==null)return pendingOf(row)
 const d=workspaceSchema.safeParse(row.draft),p=workspaceSchema.safeParse(row.published)
 return !(d.success&&p.success)||pendingOf({draft:d.data,published:p.data})
}
/** Corpo di GET /api/menu-workspace (route operativa ed edge di lettura): campi di prima + pending + dashboardEditor. */
export function workspaceBody(row:WorkspaceRow,restaurant:{name?:string|null;settings?:unknown}|undefined){
 return {data:commonMenuLanguages(row.draft),revision:row.revision,publishedRevision:row.published_revision,pending:pendingNormalized(row),dashboardEditor:dashboardEditorEnabled(restaurant?.settings),presentation:{restaurantName:restaurant?.name??'Menu',foodCatalogs}}
}
export type WorkspaceStatus={revision:number;publishedRevision:number|null;pending:boolean;lastLabel:string|null;lastAt:string|null}
/** GET /api/menu-workspace/status: ~100 byte, solo SELECT. pending = draft IS DISTINCT FROM published (jsonb). Ultima etichetta = ultima riga di storico. */
export async function readWorkspaceStatus(tenant:string,connection:Pick<DB,'execute'>=db):Promise<WorkspaceStatus|null>{
 const rows=await connection.execute(sql`SELECT w.revision,w.published_revision,(w.draft IS DISTINCT FROM w.published) AS pending,v.label,v.created_at
 FROM menu_workspaces w LEFT JOIN LATERAL (SELECT label,created_at FROM menu_workspace_versions WHERE restaurant_id=w.restaurant_id ORDER BY created_at DESC,revision DESC LIMIT 1) v ON true WHERE w.restaurant_id=${tenant}`)
 const r=rows[0];if(!r)return null
 const at=r.created_at as unknown
 return {revision:Number(r.revision),publishedRevision:r.published_revision==null?null:Number(r.published_revision),pending:r.pending===true,lastLabel:r.label==null?null:String(r.label),lastAt:at==null?null:at instanceof Date?at.toISOString():String(at)}
}
/** Workspace mai creato: stato vuoto (nessuna scrittura da una lettura). */
export const EMPTY_STATUS:WorkspaceStatus={revision:0,publishedRevision:null,pending:false,lastLabel:null,lastAt:null}
/** Corpo di /status: campi in testa (CONTRATTO §3) e anche in `data` come le altre rotte del pannello. */
export const statusBody=(status:WorkspaceStatus)=>({...status,data:status})
