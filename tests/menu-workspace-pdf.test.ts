import { it,expect } from 'vitest'
import { randomUUID } from 'node:crypto'
import { workspaceSchema } from '../apps/server/src/lib/menu-workspace-contract.js'
import { renderWorkspacePdf } from '../apps/server/src/lib/menu-workspace-pdf.js'
it('renders a real bounded multi-page PDF with Unicode and selected menus',async()=>{
 const menuId=randomUUID(),restaurantId=randomUUID();const w=workspaceSchema.parse({menus:[{id:menuId,name:'Caffè e specialità',sections:[{id:randomUUID(),name:'Piatti',items:Array.from({length:120},(_,i)=>({id:randomUUID(),name:`Piatto ${i} — caffè`,description:'Preparazione con verdure e formaggio, prezzo aggiornato.',price:12.5,allergens:['latte']}))}]}],pdf:{columns:2,showQr:false}})
 const bytes=await renderWorkspacePdf(w,[menuId],'it','Tako · Verifica',restaurantId)
 expect(bytes.subarray(0,8).toString()).toMatch(/^%PDF-1\./)
 expect(bytes.length).toBeGreaterThan(10000)
 expect(bytes.toString('latin1').match(/\/Type \/Page\b/g)!.length).toBeGreaterThan(1)
})
