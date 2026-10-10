import { writeFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { workspaceSchema } from '../../apps/server/src/lib/menu-workspace-contract.js'
import { renderWorkspacePdf } from '../../apps/server/src/lib/menu-workspace-pdf.js'
const menuId=randomUUID();const w=workspaceSchema.parse({languages:['it','ar'],menus:[{id:menuId,name:'Menu di verifica',translations:{ar:{name:'قائمة الطعام'}},sections:[{id:randomUUID(),name:'Piatti della cucina',translations:{ar:{name:'الأطباق'}},items:Array.from({length:35},(_,i)=>({id:randomUUID(),name:`Ravioli di stagione ${i+1}`,description:i===5?'Descrizione lunga: '.repeat(45):'Verdure di stagione, formaggio e olio extravergine.',price:12.5,allergens:['glutine','latte'],translations:{ar:{name:'طبق لذيذ',description:'الخضروات الطازجة مع الجبن'}}}))}]}],pdf:{columns:2,marginLeft:48,marginRight:36,marginTop:42,marginBottom:40,showQr:false,showDate:true,footer:'Tako · Verifica del documento'}})
await writeFile('tmp/pdfs/parity-menu.pdf',await renderWorkspacePdf(w,[menuId],'it','Tako',randomUUID()))
await writeFile('tmp/pdfs/parity-menu-arabic.pdf',await renderWorkspacePdf(w,[menuId],'ar','Tako',randomUUID()))
