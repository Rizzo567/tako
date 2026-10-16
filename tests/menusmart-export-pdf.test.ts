import {describe,it,expect} from 'vitest'
import {randomUUID} from 'node:crypto'
import {workspaceSchema} from '../apps/server/src/lib/menu-workspace-contract.js'
import {renderWorkspacePdf} from '../apps/server/src/lib/menu-workspace-pdf.js'
import {archiveWorkspace,archiveItemNames,verifyArchivePdf} from '../scripts/menusmart-migration/export-pdfs.js'
const closed={enabled:true,from:'2099-01-01',until:'2099-12-31',windows:[],timezone:'Europe/Rome'}
describe('MenuSmart printed archive',()=>{
 it('prints inactive/off-hour menus and future categories, preserving deliberate hiding and hierarchy',async()=>{
  const menuId=randomUUID(),parent=randomUUID();
  const source=workspaceSchema.parse({menus:[{id:menuId,name:'Cena archivio',active:false,schedule:closed,sections:[{id:parent,name:'Categoria futura',schedule:closed,items:[{id:randomUUID(),name:'Risotto archivio',price:9,schedule:closed},{id:randomUUID(),name:'Segreto nascosto',price:4,hidden:true}]},{id:randomUUID(),name:'Sottocategoria futura',parentSectionId:parent,schedule:closed,items:[{id:randomUUID(),name:'Dolce archivio',price:5,schedule:closed}]},{id:randomUUID(),name:'Categoria nascosta',active:false,items:[{id:randomUUID(),name:'Piatto invisibile',price:4}]}]}],pdf:{includeUnavailable:true,showQr:false}});
  const archive=archiveWorkspace(source,menuId),names=archiveItemNames(archive,'it');
  expect(names).toEqual(['Risotto archivio','Dolce archivio']);expect(source.menus[0].active).toBe(false);expect(source.menus[0].schedule?.enabled).toBe(true);
  const bytes=await renderWorkspacePdf(archive,[menuId],'it','Archivio',randomUUID());
  expect(await verifyArchivePdf(bytes,names)).toMatchObject({visibleItems:2,textVerified:true});
  await expect(verifyArchivePdf(bytes,['Segreto nascosto'])).rejects.toThrow('missing expected');
 });
 it('reports genuinely empty menus as zero visible items',async()=>{
  const menuId=randomUUID(),w=workspaceSchema.parse({menus:[{id:menuId,name:'Vuoto',active:false}],pdf:{showQr:false}}),archive=archiveWorkspace(w,menuId);
  expect(archiveItemNames(archive,'it')).toEqual([]);
  const bytes=await renderWorkspacePdf(archive,[menuId],'it','Archivio vuoto',randomUUID());
  expect(await verifyArchivePdf(bytes,[])).toMatchObject({visibleItems:0,textVerified:true});
 });
});
