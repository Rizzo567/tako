// Prova senza rete né DB: il «piatto del giorno» del bot (schedule from=until=oggi) sparisce sulla pagina pubblica?
// La pagina pubblica passa dal Worker, che forza catalogOnly=1 → publicWorkspace(..., {ignoreSchedules:true}).
import {publicWorkspace} from '../../../../apps/server/src/lib/menu-workspace-schedule.ts'
import {applyActions} from '../../../../apps/server/src/lib/twilio-menu-ai.ts'
import {workspaceSchema} from '../../../../apps/server/src/lib/menu-workspace-contract.ts'
import {randomUUID} from 'node:crypto'
const w:any=workspaceSchema.parse({menus:[{id:randomUUID(),name:'Menu',sections:[{id:randomUUID(),name:'Primi',items:[{id:randomUUID(),name:'Carbonara',price:10}]}]}]})
const yesterday=new Date('2026-10-15T10:00:00Z'),tomorrow=new Date('2026-10-17T10:00:00Z')
applyActions(w,[{kind:'special',name:'Risotto',price:16,description:null}],{timezone:'Europe/Rome',now:yesterday})
const next:any=workspaceSchema.parse(w)
const names=(x:any)=>x.menus.flatMap((m:any)=>m.sections.flatMap((s:any)=>s.items.map((i:any)=>i.name)))
console.log(JSON.stringify({
 creatoIl:'2026-10-15',
 letturaIl_2026_10_17_conOrari:names(publicWorkspace(next,tomorrow)),
 letturaIl_2026_10_17_viaWorker_catalogOnly:names(publicWorkspace(next,tomorrow,{ignoreSchedules:true})),
}))
