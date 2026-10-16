// Letture del workspace menu condivise tra la route Fastify (servizio operativo) e la
// read-edge (lib/edge-read-handler.ts). UNA sola implementazione del corpo di risposta:
// le due strade non possono divergere. Nessuna scrittura qui dentro.
import { workspaceSchema } from './menu-workspace-contract.js'
import { workspaceDiff } from './menu-workspace-schedule.js'
import type { WorkspaceRow } from './menu-workspace-store.js'

/** Corpo di GET /api/menu-workspace/publish/diff: differenze bozza ↔ pubblicato + revisioni. */
export function publishDiffBody(row: WorkspaceRow) {
 return {data:{...workspaceDiff(row.published?workspaceSchema.parse(row.published):workspaceSchema.parse({menus:[]}),workspaceSchema.parse(row.draft)),revision:row.revision,publishedRevision:row.published_revision}}
}
