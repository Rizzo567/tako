import {it,expect} from 'vitest'
import {randomUUID} from 'node:crypto'
import {workspaceSchema} from '../apps/server/src/lib/menu-workspace-contract.js'
import {publicWorkspace,workspaceDiff} from '../apps/server/src/lib/menu-workspace-schedule.js'
import {projectMenuPreview} from '../apps/web/src/lib/menu-preview-calendar.js'
const sample=()=>workspaceSchema.parse({menus:[{id:randomUUID(),name:'Cena',sections:[{id:randomUUID(),name:'Primi',items:[{id:randomUUID(),name:'Ravioli',price:12},{id:randomUUID(),name:'Pasta',price:8,hidden:true}]}]}]})
it('hidden stays distinct from unavailable and legacy defaults remain visible',()=>{const w=sample();expect(w.menus[0]!.sections[0]!.items[0]!.hidden).toBe(false);expect(w.menus[0]!.sections[0]!.items[1]!.available).toBe(true);expect(publicWorkspace(w).menus[0]!.sections[0]!.items.map(i=>i.name)).toEqual(['Ravioli']);expect(w.menus[0]!.sections[0]!.items).toHaveLength(2)})
it('preview never leaks hidden items even without calendar simulation',()=>{const w=sample();for(const now of [undefined,new Date()])expect(projectMenuPreview(w,w.menus[0]!.id,'it',now).menu.sections[0].items.map((i:any)=>i.name)).toEqual(['Ravioli'])})
it('unhide is an explicit editorial diff preserving ID and price',()=>{const before=sample(),after=structuredClone(before);after.menus[0]!.sections[0]!.items[1]!.hidden=false;const d=workspaceDiff(before,after);expect(d.added).toEqual([]);expect(d.removed).toEqual([]);expect(d.details[0]!.fields).toContainEqual({field:'hidden',label:'Nascosto',before:true,after:false})})
